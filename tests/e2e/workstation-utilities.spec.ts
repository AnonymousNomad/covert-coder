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
  const sessions: Array<{sessionId:string;provider:string;shell:string;cwd:string;cols:number;rows:number}> = [];
  const geometry=new Map<string,{cols:number;rows:number}>();
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
    if(response.request().method()==='GET' && url.pathname==='/api/terminal/sessions'){
      void response.json().then((raw:{data?:{sessions?:Array<{sessionId:string;cols:number;rows:number}>}})=>{for(const session of raw.data?.sessions??[]) geometry.set(session.sessionId,{cols:session.cols,rows:session.rows});});
    }
    if(response.request().method()==='POST' && url.pathname==='/api/terminal/sessions'){
      void response.json().then((raw:{ok?:boolean;data?:{session?:{sessionId:string;provider:string;shell:string;cwd:string;cols:number;rows:number}}})=>{if(raw.ok && raw.data?.session) sessions.push(raw.data.session);});
    }
  });
  await page.addInitScript(() => {
    (globalThis as typeof globalThis & {__AIDE_RUNTIME_CONFIG__?:{facadeOrigin:string}}).__AIDE_RUNTIME_CONFIG__={facadeOrigin:window.location.origin};
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Pair browser session',exact:true}).click();
  await expect(page.locator('[aria-label="Authority paired: PAIRED"]')).toBeVisible();
  return {errors,sessions,geometry,get sample() {return sample;}};
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

  const appMutations:string[]=[];
  page.on('request',request=>{
    if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/')) appMutations.push(new URL(request.url()).pathname);
  });
  const openUtility=async(id:string)=>{
    await page.locator(`.desktop-application-rail button[data-app-id="${id}"]`).click();
    const window=page.locator(`.desktop-window[data-app-id="${id}"]`);
    await expect(window).toBeVisible();
    return window;
  };
  const modelResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/models/manager'&&response.status()===200);
  const models=await openUtility('models');
  const modelOwner=await (await modelResponse).json() as {ok:boolean;data:{models:unknown[];routes:Array<{available:boolean}>}};
  expect(modelOwner.ok).toBe(true);
  await expect(models.locator('.models-counts')).toContainText(`${modelOwner.data.models.length} KNOWN MODELS · ${modelOwner.data.routes.filter(route=>route.available).length} / ${modelOwner.data.routes.length} AVAILABLE ROUTES`);
  await page.screenshot({path:test.info().outputPath('covert-models-application.png'),fullPage:true});
  await models.getByRole('button',{name:'Minimize window',exact:true}).click();

  const connectionResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/connections'&&response.status()===200);
  const connections=await openUtility('connections');
  const connectionOwner=await (await connectionResponse).json() as {ok:boolean;data:{consensus:string}};
  expect(connectionOwner.ok).toBe(true);
  await expect(connections.locator('.connections-consensus')).toHaveText(connectionOwner.data.consensus);
  await page.screenshot({path:test.info().outputPath('covert-connections-application.png'),fullPage:true});
  await connections.getByRole('button',{name:'Minimize window',exact:true}).click();

  const auditResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/audit/events'&&response.status()===200);
  const evidence=await openUtility('verification');
  const auditOwner=await (await auditResponse).json() as {ok:boolean;data:{events:unknown[]}};
  expect(auditOwner.ok).toBe(true);
  await expect(evidence.locator('.verification-section-title').last()).toContainText(`RECENT AGENT.VERIFICATION EVENTS (${auditOwner.data.events.length})`);
  await page.screenshot({path:test.info().outputPath('covert-evidence-application.png'),fullPage:true});
  await evidence.getByRole('button',{name:'Minimize window',exact:true}).click();

  const settings=await openUtility('settings');
  await expect(settings.getByRole('combobox',{name:'Theme',exact:true})).toHaveValue('COVERT_PHOSPHOR');
  await expect(settings.locator('.desktop-settings-feedback').last()).toContainText('MICROPHONE: OFF');
  await page.screenshot({path:test.info().outputPath('covert-settings-application.png'),fullPage:true});
  await settings.getByRole('button',{name:'Minimize window',exact:true}).click();
  expect(appMutations).toEqual([]);
  expect(observation.errors).toEqual([]);
});

test('selected WSL terminal executes in the exact distribution without native fallback', async ({page}) => {
  test.skip(process.platform !== 'win32', 'Windows WSL proof requires the Windows host');
  const {errors,sessions,geometry}=await pairWorkstation(page,'wsl');
  await page.setViewportSize({width:1440,height:900});
  page.on('response', response => {
    if(response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/terminal/sessions'){
      void response.json().then((raw:{error?:unknown;data?:{session?:unknown}})=>console.log('WSL_OWNER_RESPONSE',response.status(),JSON.stringify(raw.error??raw.data?.session))).catch(()=>{});
    }
  });
  const frame=page.locator('.desktop-window[data-instance-id="terminal"]');
  const second=page.locator('.desktop-window[data-instance-id="terminal:2"]');
  const focus=async(label:string)=>page.getByRole('button',{name:`Focus or restore ${label}, open`,exact:true}).click();
  await focus('Terminal 01');
  const wsl=frame.locator('.terminal-provider').filter({hasText:/^WSL/});
  await expect(wsl).toContainText('AVAILABLE');
  await frame.locator('.terminal-open .terminal-select').first().selectOption('wsl');
  const distro=frame.locator('.terminal-open .terminal-select').nth(1);
  await distro.selectOption('Ubuntu-24.04');
  const distroId=await distro.inputValue();
  expect(distroId).toBe('Ubuntu-24.04');
  console.log('WSL_OBSERVED_START_STATE',await distro.locator('option:checked').innerText());
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
    await focus('Terminal 02');
    await second.locator('.terminal-open .terminal-select').first().selectOption('wsl');
    await second.locator('.terminal-open .terminal-select').nth(1).selectOption(distroId);
    await second.getByRole('button',{name:'OPEN SESSION',exact:true}).click();
    await expect(second.locator('.terminal-session-state')).toContainText('RUNNING');
    await expect.poll(()=>sessions.length).toBe(2);
    expect(new Set(sessions.map(session=>session.sessionId)).size).toBe(2);
    expect(sessions.every(session=>session.provider==='wsl'&&session.shell===distroId)).toBe(true);
    const warmSuffix=randomUUID().replaceAll('-','');
    const warmMarker=`COVERT_WARM_${warmSuffix}`;
    await second.locator('.xterm-helper-textarea').pressSequentially(`printf 'COVERT_WARM_%s\\n' '${warmSuffix}'`);
    await second.locator('.xterm-helper-textarea').press('Enter');
    await expect(second.locator('.xterm-screen')).toContainText(warmMarker);
    await expect(frame.locator('.xterm-screen')).not.toContainText(warmMarker);
    await expect(second.locator('.xterm-screen')).not.toContainText(marker);
    await focus('Terminal 01');
    await frame.getByRole('button',{name:'REFRESH',exact:true}).click();
    const sessionId=sessions[0]!.sessionId;
    await expect.poll(()=>geometry.get(sessionId)?.cols??0).toBeGreaterThan(0);
    const beforeCols=geometry.get(sessionId)!.cols;
    await frame.getByRole('button',{name:'Maximize or restore window',exact:true}).click();
    await expect.poll(async()=>{
      await frame.getByRole('button',{name:'REFRESH',exact:true}).click();
      return geometry.get(sessionId)?.cols??beforeCols;
    }).not.toBe(beforeCols);
    await frame.getByRole('button',{name:'Maximize or restore window',exact:true}).click();
    const sleepSuffix=randomUUID().replaceAll('-','');
    await frame.locator('.xterm-helper-textarea').pressSequentially(`printf 'COVERT_SLEEP_%s\\n' '${sleepSuffix}'; sleep 30`);
    await frame.locator('.xterm-helper-textarea').press('Enter');
    await expect(frame.locator('.xterm-screen')).toContainText(`COVERT_SLEEP_${sleepSuffix}`);
    await frame.locator('.xterm-helper-textarea').press('Control+c');
    const cancelSuffix=randomUUID().replaceAll('-','');
    await frame.locator('.xterm-helper-textarea').pressSequentially(`printf 'COVERT_CANCELLED_%s\\n' '${cancelSuffix}'`);
    await frame.locator('.xterm-helper-textarea').press('Enter');
    await expect(frame.locator('.xterm-screen')).toContainText(`COVERT_CANCELLED_${cancelSuffix}`);
    await page.screenshot({path:test.info().outputPath('covert-wsl-terminal.png'),fullPage:true});
    await focus('Terminal 02');
    await second.locator('.xterm-helper-textarea').pressSequentially('exit');
    await second.locator('.xterm-helper-textarea').press('Enter');
    await expect(second.locator('.terminal-session')).toContainText(/Session stopped/i);
    await focus('Terminal 01');
    await frame.locator('.xterm-helper-textarea').pressSequentially('exit');
    await frame.locator('.xterm-helper-textarea').press('Enter');
    await expect(frame.locator('.terminal-session')).toContainText(/Session stopped/i);
    expect(errors).toEqual([]);
  } catch(error) {
    console.log('WSL_UI_ON_FAILURE',await frame.innerText());
    await page.screenshot({path:test.info().outputPath('covert-wsl-failure.png'),fullPage:true});
    throw error;
  } finally {
    for(const [index,terminal] of (page.isClosed()?[]:[frame,second]).entries()){
      const stop=terminal.getByRole('button',{name:'STOP SESSION',exact:true});
      if(await stop.isVisible()){
        await focus(index===0?'Terminal 01':'Terminal 02');
        await stop.click();
        await expect(terminal.locator('.terminal-session')).toContainText(/Session stopped/i);
      }
    }
  }
});
