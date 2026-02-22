# Air Configuration

This project has two Air configurations for development:

## Windows Configuration (Default)
**File:** `.air.toml`  
**Usage:** `air`

Builds and runs the Windows executable (`.exe`). The terminal functionality uses Windows ConPTY which has known issues with PowerShell prompts.

## Linux Configuration (WSL)
**File:** `.air.linux.toml`  
**Usage:** `air -c .air.linux.toml`

Builds and runs the Linux binary in WSL (OracleLinux_9_1). This provides proper Linux PTY support and fixes terminal issues.

### Prerequisites for Linux mode:
- WSL OracleLinux_9_1 distribution installed
- Go installed at `/root/sdk/go1.25.3/bin/go` in WSL
- templ installed at `~/go/bin/templ` in WSL
- npm available in WSL PATH

### Running with Linux configuration:
```powershell
air -c .air.linux.toml
```

Or update your VS Code task to use the Linux configuration.
