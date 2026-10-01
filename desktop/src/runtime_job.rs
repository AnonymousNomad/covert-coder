//! Windows process lifetime containment for the desktop-owned runtime tree.
//!
//! Establish membership before spawning any worker; attaching a running launcher
//! later leaves a race where it can already have spawned uncontained children.
use std::io;
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle, IntoRawHandle, OwnedHandle};
use std::ptr;
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Threading::GetCurrentProcess;

fn process_lifetime_limits() -> JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    limits
}

/// Scope this desktop process and its future descendants to an unnamed job.
///
/// The handle is non-inheritable and retained for the *process* lifetime. Windows
/// closes it on both ordinary exit and TerminateProcess, killing the descendants
/// even when Rust/Tauri exit callbacks cannot run. Closing it earlier would kill
/// this process too, so it must not be a Rust guard dropped during unwinding.
/// No breakaway, memory/commit, UI, privilege or scheduling limits are enabled.
pub fn bind_current_process() -> io::Result<()> {
    // SAFETY: null security/name creates a private, non-inheritable job handle.
    let raw = unsafe { CreateJobObjectW(ptr::null(), ptr::null()) };
    if raw.is_null() {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: CreateJobObjectW returned a uniquely owned valid handle. This guard
    // releases the unassigned job if configuration or assignment fails.
    let job = unsafe { OwnedHandle::from_raw_handle(raw) };
    let limits = process_lifetime_limits();
    // SAFETY: pointer/size match the documented Win32 extended-limit structure;
    // the synchronous call only reads it while it remains alive.
    let configured = unsafe {
        SetInformationJobObject(
            job.as_raw_handle(),
            JobObjectExtendedLimitInformation,
            ptr::from_ref(&limits).cast(),
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    };
    if configured == 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: pseudo-handle identifies only this process; the job has no UI or
    // quota restrictions and no existing members. Supported Windows permits
    // nesting under the caller's job. Any failure blocks startup explicitly.
    let assigned = unsafe { AssignProcessToJobObject(job.as_raw_handle(), GetCurrentProcess()) };
    if assigned == 0 {
        return Err(io::Error::last_os_error());
    }
    // Intentionally hand lifetime ownership to process termination. This is not
    // a per-launch leaked handle: bind_current_process is called once, and the
    // kernel closes all this process's handles at termination. Descendants do
    // not inherit the job handle, so none can keep it alive after desktop exit.
    let _process_owned_handle = job.into_raw_handle();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_job_enables_only_process_lifetime_cleanup() {
        let limits = process_lifetime_limits();
        assert_eq!(
            limits.BasicLimitInformation.LimitFlags,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        );
        assert_eq!(limits.BasicLimitInformation.ActiveProcessLimit, 0);
        assert_eq!(limits.BasicLimitInformation.PriorityClass, 0);
        assert_eq!(limits.ProcessMemoryLimit, 0);
        assert_eq!(limits.JobMemoryLimit, 0);
    }
}
