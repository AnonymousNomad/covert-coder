import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { HardwareProfileResponseT } from '../../common/contracts/hardware.ts';
const proofFile = process.env.AIDE_WORKSTATION_E2E_PAIRING_PROOF;
if (!proofFile) throw new Error('isolated workstation pairing proof is unavailable');

async function pairWorkstation(page: Page, suffix: string) {
  const proof = await fs.readFile(`${proofFile}.${suffix}`, 'utf8');
  const errors: string[] = [];
  let sample: HardwareProfileResponseT | null = null;
  const sessions: Array<{provider:string;shell:string;cwd:string}> = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if(dialog.type()==='prompt') return dialog.accept(proof);
    const prefix='Approve this operation once?\n';
    if(dialog.type()==='confirm' && dialog.message().startsWith(prefix)){
      const decision=JSON.parse(dialog.message().slice(prefix.length)) as {operation?:string};
      if(['terminal.session.start','terminal.session.stop'].includes(decision.operation ?? '')) return dialog.accept();
    }
    return dialog.dismiss();
  });
  page.on('response', response => {
    const url=new URL(response.url());
    if(url.pathname==='/api/hardware/profile') void response.json().then((raw:{ok?:boolean;data?:HardwareProfileResponseT})=>{if(raw.ok && raw.data) sample=raw.data;});
    if(response.request().method()==='POST' && url.pathname==='/api/terminal/sessions'){
      void response.json().then((raw:{ok?:boolean;data?:{session?:{provider:string;shell:string;cwd:string}}})=>{if(raw.ok && raw.data?.session) sessions.push(raw.data.session);});
    }
  });
  await page.addInitScript(() => {
    (globalThis as typeof globalThis & {__AIDE_RUNTIME_CONFIG__?:{facadeOrigin:string}}).__AIDE_RUNTIME_CONFIG__={facadeOrigin:window.location.origin};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Pair browser session',exact:true}).click();
  await expect(page.locator('[aria-label="Authority paired: PAIRED"]')).toBeVisible();
  return {errors,sessions,get sample() {return sample;}};
}

test('Resource Monitor projects real hardware owner samples through workstation lifecycle', async ({page}) => {
  const observation=await pairWorkstation(page,'utilities');
  await page.keyboard.press('Alt+8');
  const monitor=page.locator('.desktop-window[data-app-id="resources"]');
  await expect(monitor).toBeVisible();
  await expect(monitor.locator('.resource-monitor-status')).toContainText('SNAPSHOT');
  await expect.poll(()=>observation.sample!==null).toBe(true);
  const observed=observation.sample as HardwareProfileResponseT | null;
  if(!observed) throw new Error('hardware response was not observed');
  const ram=monitor.locator('tr').filter({has:page.locator('th').filter({hasText:/^RAM$/})});
  await expect(ram).toContainText(`${((observed.totalRamBytes-observed.freeRamBytes)/1024**3).toFixed(1)} / ${(observed.totalRamBytes/1024**3).toFixed(1)} GB`);
  for(const metric of ['CPU','DISK','COMMIT','GPU']){
    await expect(monitor.locator('tr').filter({has:page.locator('th').filter({hasText:new RegExp(`^${metric}$`)})})).toContainText('UNAVAILABLE');
  }
  await monitor.getByRole('button',{name:'Minimize window',exact:true}).click();
  await expect(monitor).toBeHidden();
  await page.getByRole('button',{name:'Focus or restore Resource Monitor, minimized',exact:true}).click();
  await expect(monitor).toBeVisible();
  await monitor.getByRole('button',{name:'Close window',exact:true}).click();
  await expect(monitor).toHaveCount(0);
  await page.keyboard.press('Alt+8');
  await expect(monitor).toBeVisible();
  await page.screenshot({path:test.info().outputPath('covert-resource-monitor.png'),fullPage:true});
  await monitor.getByRole('button',{name:'Minimize window',exact:true}).click();

  expect(observation.errors).toEqual([]);
});

test('selected WSL terminal executes in the exact distribution without native fallback', async ({page}) => {
  test.skip(process.platform !== 'win32', 'Windows WSL proof requires the Windows host');
  const {errors,sessions}=await pairWorkstation(page,'wsl');
  const frame=page.locator('.desktop-window[data-instance-id="terminal"]');
  const wsl=frame.locator('.terminal-provider').filter({hasText:/^WSL/});
  await expect(wsl).toContainText('AVAILABLE');
  await frame.locator('.terminal-open .terminal-select').first().selectOption('wsl');
  const distro=frame.locator('.terminal-open .terminal-select').nth(1);
  const distroId=await distro.inputValue();
  expect(distroId).not.toContain('\0');
  await expect(distro.locator('option:checked')).toContainText(/\[(STOPPED|RUNNING|UNKNOWN)\]/);
  try {
    await frame.getByRole('button',{name:'OPEN SESSION',exact:true}).click();
    await expect(frame.locator('.terminal-session-state')).toContainText('RUNNING');
    await expect.poll(()=>sessions.length).toBe(1);
    expect(sessions[0]?.provider).toBe('wsl');
    expect(sessions[0]?.shell).toBe(distroId);
    expect(sessions[0]?.cwd).toMatch(/^\/mnt\//);
    const suffix=randomUUID().replaceAll('-','');
    const marker=`COVERT_WSL_${suffix}`;
    await expect(frame.locator('.terminal-output-status')).toContainText('OUTPUT SYNCHRONIZED');
    await frame.locator('.xterm-helper-textarea').pressSequentially(`printf 'COVERT_WSL_%s\\n' '${suffix}'; pwd`);
    await frame.locator('.xterm-helper-textarea').press('Enter');
    await expect(frame.locator('.xterm-screen')).toContainText(marker);
    await expect(frame.locator('.xterm-screen')).toContainText(sessions[0]!.cwd);
    await page.screenshot({path:test.info().outputPath('covert-wsl-terminal.png'),fullPage:true});
    await frame.locator('.xterm-helper-textarea').pressSequentially('exit');
    await frame.locator('.xterm-helper-textarea').press('Enter');
    await expect(frame.locator('.terminal-session')).toContainText(/Session stopped/i);
    expect(errors).toEqual([]);
  } finally {
    const stop=frame.getByRole('button',{name:'STOP SESSION',exact:true});
    if(!page.isClosed() && await stop.isVisible()) {
      await stop.click();
      await expect(frame.locator('.terminal-session')).toContainText(/Session stopped/i);
    }
  }
});
