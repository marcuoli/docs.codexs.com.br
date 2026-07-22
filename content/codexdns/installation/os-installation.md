---
title: "Package Installation"
description: "Install CodexDNS on Linux using native packages (APK, RPM, DEB)."
weight: 10
---

# Package Installation

CodexDNS ships as native Linux packages for Alpine, RPM-based, and Debian-based systems. This is the recommended installation method for bare-metal servers, VMs, and cloud instances.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | x86_64, 1 core | 2+ cores |
| **RAM** | 256 MB | 1 GB+ |
| **Disk** | 200 MB | 2 GB+ (for logs and DB) |
| **Network** | 1× Ethernet | 1× Ethernet |

### Supported Distributions

| Package | Distributions |
|---------|---------------|
| **APK** | Alpine Linux 3.18+ |
| **RPM** | RHEL / CentOS / Oracle Linux / Fedora |
| **DEB** | Debian 11+, Ubuntu 22.04+ |

---

## Installation

### Alpine Linux (APK)

```bash
# Download the latest APK from GitHub Releases
LATEST=$(curl -s https://api.github.com/repos/marcuoli/codexdns/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)

curl -LO "https://github.com/marcuoli/codexdns/releases/download/${LATEST}/codexdns_${LATEST#v}_x86_64.apk"

# Install
apk add --allow-untrusted codexdns_*.apk
```

### RHEL / Oracle Linux / CentOS / Fedora (RPM)

```bash
# Download
LATEST=$(curl -s https://api.github.com/repos/marcuoli/codexdns/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)

curl -LO "https://github.com/marcuoli/codexdns/releases/download/${LATEST}/codexdns-${LATEST#v}-1.x86_64.rpm"

# Install
dnf install -y ./codexdns-*.x86_64.rpm
```

### Debian / Ubuntu (DEB)

```bash
# Download
LATEST=$(curl -s https://api.github.com/repos/marcuoli/codexdns/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)

curl -LO "https://github.com/marcuoli/codexdns/releases/download/${LATEST}/codexdns_${LATEST#v}_amd64.deb"

# Install
apt install -y ./codexdns_*_amd64.deb
```

---

## What Gets Installed

| Path | Contents |
|------|----------|
| `/usr/bin/codexdns` | Application binary |
| `/etc/codexdns/config.json` | Default configuration file |
| `/var/lib/codexdns/` | Database and data directory |
| `/var/log/codexdns/` | Log files |
| `/etc/init.d/codexdns` | Service script (Alpine / OpenRC) |
| `/lib/systemd/system/codexdns.service` | systemd unit (RPM / DEB) |

---

## Starting the Service

### Alpine (OpenRC)

```bash
# Enable and start
rc-update add codexdns default
rc-service codexdns start

# Check status
rc-service codexdns status

# View logs
tail -f /var/log/codexdns/http.log
```

### RHEL / Debian / Ubuntu (systemd)

```bash
# Enable and start
systemctl enable --now codexdns

# Check status
systemctl status codexdns

# View logs
journalctl -u codexdns -f
```

---

## Configuration

The default configuration file is at `/etc/codexdns/config.json`. Edit it before or after starting the service.

```json
{
  "http_port": 8080,
  "dns_port": 53,
  "db_driver": "sqlite",
  "db_dsn": "/var/lib/codexdns/codexdns.db",
  "redis_addr": "",
  "log_level": "info",
  "log_http": "/var/log/codexdns/http.log",
  "log_dns": "/var/log/codexdns/dns.log",
  "log_dhcp": "/var/log/codexdns/dhcp.log"
}
```

After editing, restart the service:

```bash
# Alpine
rc-service codexdns restart

# systemd
systemctl restart codexdns
```

### DNS Port Binding

Port 53 requires elevated privileges. The package installer handles this automatically. If you need a non-privileged port for testing, set `dns_port` to `5353` or higher in the config.

---

## Firewall Rules

Open the required ports on your host firewall:

```bash
# firewalld (RPM-based distros)
firewall-cmd --permanent --add-service=dns
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --reload

# ufw (Debian / Ubuntu)
ufw allow 53/udp
ufw allow 53/tcp
ufw allow 8080/tcp
```

---

## First Login

Once the service is running, open the web UI:

```
http://<server-ip>:8080/
```

Default credentials:

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | Printed in startup log (auto-generated) |

On first run, CodexDNS generates a random 24-character password and prints it to the log:

```
************************************************************
* CODEXDNS FIRST-BOOT: no CODEXDNS_ADMIN_PASSWORD set.     *
* A temporary admin password has been generated:            *
*   Username : admin                                         *
*   Password : <generated-password>                         *
* You MUST change this password immediately after login.     *
************************************************************
```

To set a fixed password instead, export the env var **before** the first run:

```bash
# systemd override
systemctl edit codexdns
# Add:
[Service]
Environment="CODEXDNS_ADMIN_PASSWORD=your-strong-password"

# Or export directly (for manual/test runs)
export CODEXDNS_ADMIN_PASSWORD=your-strong-password
codexdns -config /etc/codexdns/config.json
```

> ⚠️ **Change the admin password immediately** after first login via **Settings → Profile**.

---

## Upgrading

Download the new package and re-install — the package manager handles upgrades in place.

```bash
# APK
apk add --allow-untrusted codexdns_<new-version>_x86_64.apk

# RPM
dnf upgrade -y ./codexdns-<new-version>-1.x86_64.rpm

# DEB
apt install -y ./codexdns_<new-version>_amd64.deb
```

Restart the service after upgrading:

```bash
rc-service codexdns restart     # Alpine
systemctl restart codexdns      # systemd
```

---

## Uninstalling

```bash
# Alpine
apk del codexdns

# RPM
dnf remove codexdns

# Debian / Ubuntu
apt remove codexdns
```

Data and config files under `/var/lib/codexdns/` and `/etc/codexdns/` are preserved on removal. To fully purge:

```bash
# Debian / Ubuntu
apt purge codexdns

# Manual cleanup (all distros)
rm -rf /var/lib/codexdns /etc/codexdns /var/log/codexdns
```

---

## Troubleshooting

### Service fails to start

```bash
# View detailed logs
journalctl -u codexdns --no-pager -n 50   # systemd
cat /var/log/codexdns/http.log             # all distros
```

### Port 53 already in use

```bash
# Find what is using port 53
ss -tulnp | grep :53

# Common culprit on Ubuntu — systemd-resolved
systemctl disable --now systemd-resolved

# Or use a non-privileged port for testing
# Set dns_port to 5353 in /etc/codexdns/config.json
```

### Cannot reach web UI

```bash
# Check the process is running
ps aux | grep codexdns

# Verify http_port matches what you're browsing to
grep http_port /etc/codexdns/config.json

# Check firewall
iptables -L INPUT -n | grep 8080
```

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Installation Methods](#installation-methods)
4. [Interactive Installation](#interactive-installation)
5. [Automated Installation](#automated-installation)
6. [Post-Installation](#post-installation)
7. [Network Configuration](#network-configuration)
8. [Security Hardening](#security-hardening)
9. [Troubleshooting](#troubleshooting)

---

## Overview

CodexDNS OS is a minimal, security-focused operating system designed specifically for running CodexDNS as a dedicated DNS/DHCP/NTP appliance. Built on Alpine Linux 3.23, it provides:

- **Minimal footprint**: ~150-200MB ISO, ~500MB installed
- **Security-hardened**: Read-only root, minimal attack surface
- **Dual-boot support**: BIOS (legacy) and UEFI
- **Multiple install modes**: Interactive, automated, live-boot
- **Pre-configured services**: DNS, DHCP, NTP, Web UI

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **CPU** | x86_64 (64-bit), 1 core |
| **RAM** | 512MB (1GB recommended) |
| **Disk** | 4GB (8GB recommended) |
| **Network** | 1x Ethernet adapter |
| **Boot** | BIOS or UEFI |

### Recommended for Production

| Component | Recommendation |
|-----------|----------------|
| **CPU** | 2+ cores |
| **RAM** | 2GB+ |
| **Disk** | 16GB+ SSD |
| **Network** | 2x Gigabit Ethernet (management + service) |

### Supported Platforms

- ✅ **Bare metal**: x86_64 servers, workstations, mini PCs
- ✅ **Virtual machines**: VMware ESXi, VirtualBox, QEMU/KVM, Hyper-V
- ✅ **Cloud**: EC2, GCE, Azure (with appropriate instance types)
- ⚠️ **Containers**: Not applicable (CodexDNS OS is a full OS, not a container image)

---

## Installation Methods

CodexDNS OS supports three installation modes:

### 1. Interactive Installation (Default)

- Guided TUI wizard
- Manual configuration of all settings
- Recommended for first-time users
- Suitable for single deployments

**Boot time**: ~5 minutes (+ configuration time)

### 2. Automated Installation (Answerfile)

- Fully unattended installation
- Pre-configured via answerfile (USB or network)
- Ideal for mass deployments
- Requires minimal user interaction

**Boot time**: ~5 minutes (fully automated)

### 3. Live Boot (No Installation)

- Runs entirely from RAM
- No disk writes (except optional LBU)
- Perfect for testing and troubleshooting
- Press `L` at boot menu

**Boot time**: ~30 seconds

---

## Interactive Installation

### Step 1: Create Installation Media

#### Option A: USB Drive (Recommended)

**Linux/macOS:**
```bash
# Find USB device (e.g., /dev/sdb)
lsblk

# Write ISO to USB (replace /dev/sdX with your device)
sudo dd if=codexdns-os-1.0.0.iso of=/dev/sdX bs=4M status=progress
sudo sync
```

**Windows:**
- Use [Rufus](https://rufus.ie/) or [balenaEtcher](https://www.balena.io/etcher/)
- Select CodexDNS OS ISO
- Write in **DD mode** (not ISO mode)

#### Option B: CD/DVD

Burn ISO to disc using your preferred tool (ImgBurn, Brasero, etc.)

#### Option C: Virtual Machine

Mount ISO directly in VM settings (no USB needed)

### Step 2: Boot from Installation Media

1. Insert USB drive or attach ISO
2. Power on system
3. Enter BIOS/UEFI boot menu (usually F12, F2, DEL, or ESC)
4. Select USB drive or CD/DVD as boot device
5. Save and reboot

### Step 3: Installation Wizard

The installer will guide you through 9 steps:

#### Step 1/9: Keyboard Layout

Select your keyboard layout:
```
us       # US English (default)
uk       # UK English
de       # German
fr       # French
es       # Spanish
...
```

#### Step 2/9: Hostname

Set the system hostname:
```
Enter hostname for this system [codexdns]: dns-server-01
```

- Must be lowercase alphanumeric with hyphens
- Max 63 characters
- Examples: `codexdns`, `dns-primary`, `ns1`

#### Step 3/9: Network Configuration

**Management Interface:**
```
Available network interfaces:
eth0    192.168.1.100/24    UP
eth1    no IP assigned      DOWN

Select management interface [eth0]: eth0
```

**IP Configuration:**

**Option A: DHCP (Easier)**
```
Use DHCP for management interface? (yes/no) [yes]: yes
✓ Configured eth0 for DHCP
```

**Option B: Static IP (Recommended for servers)**
```
Use DHCP for management interface? (yes/no) [yes]: no
Enter static IP address (e.g., 192.168.1.10/24): 192.168.1.100/24
Enter gateway IP: 192.168.1.1
Enter DNS servers (space-separated): 8.8.8.8 8.8.4.4
✓ Configured eth0 with static IP: 192.168.1.100/24
```

#### Step 4/9: Timezone

```
Available timezones:
1) UTC
2) America/New_York
3) Europe/London
4) Asia/Tokyo
...

Select timezone: UTC
```

Or search by region:
```
Enter timezone (e.g., America/Los_Angeles): Europe/Paris
```

#### Step 5/9: Disk Configuration

**Disk Selection:**
```
Available disks:
sda   (20GB)  ATA Samsung SSD
sdb   (500GB) ATA WDC WD5000
nvme0n1 (256GB) NVMe Samsung 970

Select installation disk (e.g., /dev/sda): /dev/sda
```

**CRITICAL WARNING:**
```
⚠️  WARNING: This will ERASE ALL DATA on /dev/sda!
Disk: /dev/sda (20480MB)
Type 'yes' to continue: yes
```

The installer will:
- Detect BIOS vs. UEFI boot mode
- Create appropriate partitions (GPT for UEFI, MBR for BIOS)
- Format filesystems (FAT32 for EFI, ext4 for root)

#### Step 6/9: Installing Base System

No interaction required. The installer will:
1. Mount partitions
2. Copy Alpine Linux base system
3. Install kernel and bootloader files

Progress: `[████████████████████] 100%`

#### Step 7/9: Installing CodexDNS

No interaction required. The installer will:
1. Copy CodexDNS binary to `/app/bin/`
2. Install web assets to `/app/web/`
3. Copy database migrations to `/app/migrations/`
4. Create default configuration at `/etc/codexdns/config.json`

#### Step 8/9: Administrator Account

**Username:**
```
Enter admin username [admin]: admin
```

**Password:**
```
Set password for admin:
New password: ************
Retype password: ************
✓ Admin user created: admin
```

**Password Requirements:**
- Minimum 8 characters
- Mix of uppercase, lowercase, numbers recommended
- Special characters allowed: `!@#$%^&*()`

#### Step 9/9: Installing Bootloader

No interaction required. The installer will:
- Install GRUB bootloader (UEFI or BIOS)
- Generate boot configuration
- Make disk bootable

### Step 4: Installation Complete

```
═══════════════════════════════════════════════════════════
  CodexDNS OS has been successfully installed!

  Hostname: dns-server-01
  Admin user: admin

  Web Interface will be available at:
    http://192.168.1.100:8080

  Please remove installation media and reboot.
═══════════════════════════════════════════════════════════

Reboot now? (yes/no) [yes]: yes
```

Remove USB drive and press ENTER to reboot.

---

## Automated Installation

For deploying multiple CodexDNS servers or integrating into infrastructure automation.

### Create Answerfile

Copy the template:
```bash
cp tools/iso-builder/alpine/configs/answerfile.template codexdns.conf
```

Edit `codexdns.conf`:
```bash
# System Configuration
KEYMAP="us"
HOSTNAME="dns-server-prod-01"
TIMEZONE="UTC"

# Network Configuration
MGMT_INTERFACE="eth0"
USE_DHCP="no"
STATIC_IP="10.0.1.100/24"
GATEWAY="10.0.1.1"
DNS_SERVERS="8.8.8.8 8.8.4.4"

# Disk Configuration
TARGET_DISK="/dev/sda"

# User Configuration
ADMIN_USERNAME="admin"
ADMIN_PASSWORD=""  # Leave empty for auto-generated

# Service Configuration
ENABLE_DNS="true"
ENABLE_DHCP="false"
ENABLE_NTP="true"
ENABLE_SSH="true"
SSH_ALLOW_PASSWORD="false"

# Security
ENABLE_FIREWALL="true"
ENABLE_AUTO_UPDATES="true"
```

### Deploy Answerfile

#### Method A: USB Drive

1. Format USB drive as FAT32
2. Copy `codexdns.conf` to USB root
3. Insert USB before booting from CodexDNS ISO

#### Method B: Network (PXE Boot)

Place `codexdns.conf` on HTTP server accessible during install:
```bash
# On DHCP/PXE server
echo "http://pxe-server.local/codexdns.conf" > /tftpboot/codexdns-answerfile.txt
```

### Boot with Answerfile

**Automatic USB detection:**
- Boot CodexDNS ISO
- At boot menu, select: **"Automated Install (Answerfile)"**
- Installer will search for `codexdns.conf` on all USB drives

**Manual kernel parameter:**
```
# Edit boot entry (press 'e' at GRUB menu)
linux /boot/vmlinuz-lts ... codexdns_answerfile=/path/to/codexdns.conf
```

Installation will proceed fully automatically. Check console for generated admin password if `ADMIN_PASSWORD` was empty.

---

## Post-Installation

### First Boot

After installation, CodexDNS OS will:

1. **Display login prompt:**
   ```
   CodexDNS Appliance OS 1.0 (tty1)
   
   dns-server-01 login: _
   ```

2. **Run first-boot setup** (automatic, one-time):
   - Generate self-signed TLS certificate
   - Initialize CodexDNS database
   - Enable services (DNS, Web UI)
   - Display system information

3. **Show first-boot info:**
   ```
   ╔═══════════════════════════════════════════════════════════════╗
   ║          CodexDNS OS - First Boot Information                 ║
   ╚═══════════════════════════════════════════════════════════════╝
   
   Web UI: https://192.168.1.100:8080
   Admin Username: admin
   Admin Password: (see /root/first-boot-info.txt)
   
   Service Status:
     CodexDNS: Running ✓
     Redis:    Running ✓
   ```

### Initial Login

1. **Login via console or SSH:**
   ```
   dns-server-01 login: admin
   Password: ************
   ```

2. **Access Web UI:**
   - Open browser: `http://192.168.1.100:8080`
   - Login with admin credentials
   - Follow first-time setup wizard

3. **Change admin password:**
   ```bash
   passwd
   ```

### Verify Installation

```bash
# Check CodexDNS service
rc-service codexdns status

# Check version
/app/bin/codexdns version

# View logs
tail -f /app/logs/dns.log
tail -f /app/logs/http.log

# Check network
ip addr show
ping -c 3 8.8.8.8
```

---

## Network Configuration

### Static IP Configuration

Edit `/etc/network/interfaces`:
```bash
auto eth0
iface eth0 inet static
    address 192.168.1.100/24
    gateway 192.168.1.1
```

Apply changes:
```bash
rc-service networking restart
```

### Multiple Interfaces

```bash
# Management interface
auto eth0
iface eth0 inet static
    address 10.0.0.10/24
    gateway 10.0.0.1

# DNS service interface (separate network)
auto eth1
iface eth1 inet static
    address 192.168.1.53/24
```

### VLAN Configuration

```bash
apk add vlan

# Create VLAN 10 on eth0
auto eth0.10
iface eth0.10 inet static
    address 10.0.10.10/24
    vlan-raw-device eth0
```

---

## Security Hardening

### SSH Configuration

#### Disable Password Authentication

```bash
# Edit /etc/ssh/sshd_config
PasswordAuthentication no
PubkeyAuthentication yes

# Restart SSH
rc-service sshd restart
```

#### Add SSH Key

```bash
# On your workstation
ssh-keygen -t ed25519 -C "admin@codexdns"

# Copy to server
ssh-copy-id admin@192.168.1.100
```

### Firewall Rules

Edit `/etc/iptables/rules.v4`:
```bash
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]

# Allow loopback
-A INPUT -i lo -j ACCEPT

# Allow established connections
-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH (management)
-A INPUT -p tcp --dport 22 -j ACCEPT

# Allow DNS
-A INPUT -p udp --dport 53 -j ACCEPT
-A INPUT -p tcp --dport 53 -j ACCEPT

# Allow Web UI
-A INPUT -p tcp --dport 8080 -j ACCEPT
-A INPUT -p tcp --dport 8443 -j ACCEPT

# Allow ping
-A INPUT -p icmp --icmp-type echo-request -j ACCEPT

COMMIT
```

Apply firewall:
```bash
rc-service iptables restart
rc-update add iptables default
```

### Automatic Security Updates

```bash
# Enable automatic updates
echo "0 3 * * * apk upgrade --no-cache" >> /etc/crontabs/root
rc-service crond start
rc-update add crond default
```

---

## Troubleshooting

### Boot Issues

**Problem:** System doesn't boot after installation

**Solutions:**
1. Check BIOS boot order (HDD/SSD first)
2. Disable Secure Boot (UEFI systems)
3. Try different boot mode (UEFI ↔ Legacy)
4. Re-run installer and select correct disk

---

**Problem:** Kernel panic on boot

**Solution:** Boot in recovery mode, check disk:
```bash
# At GRUB menu, select "Recovery Mode"
fsck /dev/sda2  # Check root filesystem
```

### Network Issues

**Problem:** No network connectivity after install

**Solutions:**
```bash
# Check interface status
ip link show

# Bring up interface
ip link set eth0 up

# Test DHCP
udhcpc -i eth0

# Check routes
ip route show
```

### Installation Failures

**Problem:** "No disks found"

**Solution:** Load storage drivers manually:
```bash
modprobe ahci
modprobe sd_mod
modprobe nvme
```

**Problem:** "Disk too small" error

**Solution:** Use disk ≥4GB or partition manually

### Service Issues

**Problem:** CodexDNS service won't start

**Solutions:**
```bash
# Check logs
tail -50 /app/logs/codexdns-error.log

# Test binary manually
/app/bin/codexdns --config /etc/codexdns/config.json

# Check permissions
ls -l /app/bin/codexdns
chmod +x /app/bin/codexdns
```

### Recovery Mode

Boot into recovery mode:
1. At GRUB menu, select "Recovery Mode"
2. Login as root
3. Mount filesystems manually:
   ```bash
   mount -o remount,rw /
   mount -a
   ```
4. Fix issues, then reboot

---

## Next Steps

- **Configure DNS zones**: Web UI → Zones → Add Zone
- **Set up DHCP scopes**: Web UI → DHCP → Scopes
- **Enable TLS**: Web UI → Settings → HTTPS
- **Review logs**: `/app/logs/`
- **Backup configuration**: Web UI → Settings → Export Config

For detailed configuration, see [CodexDNS Documentation](../../README.md).
