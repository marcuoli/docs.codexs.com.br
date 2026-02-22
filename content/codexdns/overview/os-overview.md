---
title: "CodexDNS OS Overview"
description: "Architecture and features of the CodexDNS appliance OS."
weight: 10
---

# CodexDNS OS - Project Summary

## Overview

**CodexDNS OS** is a hardened, minimal network appliance operating system built specifically for running CodexDNS as a dedicated DNS/DHCP/NTP server. Based on Alpine Linux 3.23, it provides a secure, lightweight platform optimized for network infrastructure deployments.

**Status:** ✅ Implementation Complete - Ready for Testing

## Key Features

### Operating System

- **Base:** Alpine Linux 3.23 (musl libc, minimal footprint)
- **Size:** ~150-200MB ISO, ~500MB installed
- **Boot modes:** BIOS (legacy) + UEFI
- **Architecture:** x86_64 (amd64)

### Installation Modes

1. **Interactive Installation** - Guided TUI wizard for manual setup
2. **Automated Installation** - Answerfile-driven unattended deployment
3. **Live Boot** - Run from RAM without disk installation

### Security Features

- Read-only root filesystem (planned)
- Minimal attack surface (~40 packages base system)
- Pre-configured firewall rules (iptables/nftables)
- SSH key-only authentication
- Automatic security updates (configurable)
- AppArmor/SELinux profiles (planned)

### Pre-Configured Services

- **CodexDNS** - Multi-protocol DNS server (UDP/TCP/DoT/DoH/DoQ)
- **Web UI** - HTTPS management interface (port 8080/8443)
- **OpenSSH** - Secure remote access
- **Chronyd** - NTP time synchronization
- **Redis** - Optional DNS caching backend
- **Firewall** - iptables rules for DNS appliance

## Project Structure

```text
tools/iso-builder/
├── README.md                          # Umbrella docs (all builders)
├── Makefile                           # Umbrella Makefile (delegates to builders)
├── alpine/
│   ├── README.md                      # Alpine builder documentation
│   ├── Makefile                       # Alpine builder automation
│   ├── build-clean.sh                 # Cleanup script
│   ├── ISO_VERSION                    # ISO version file
│   ├── scripts/
│   │   ├── build-iso.sh              # Main ISO build script
│   │   ├── customize-alpine.sh       # Alpine customization
│   │   └── codexdns-installer        # Custom TUI installer (9-step wizard)
│   ├── configs/
│   │   ├── apk-packages.txt          # Required packages list
│   │   ├── kernel-modules.txt        # Kernel modules for hardware support
│   │   ├── grub.cfg                  # GRUB (UEFI) bootloader config
│   │   ├── syslinux.cfg              # Syslinux (BIOS) bootloader config
│   │   └── answerfile.template       # Automated install template
│   └── overlays/
│       └── ...
│   ├── codexdns/
│   │   ├── theme.txt                 # GRUB theme definition
│   │   ├── background.png            # Boot splash background (TBD)
│   │   └── logo.png                  # CodexDNS logo (TBD)
│   └── ...

└── ubuntu-subiquity/
    └── ...


scripts/firstboot/
└── codexdns-setup.sh                 # First-boot setup wizard

docs/
├── codexdns-os-installation.md       # Complete installation guide
├── codexdns-os-firewall.md          # Firewall configuration templates
└── codexdns-os-vm-testing.md        # VM testing procedures
```

## Build Process

### Prerequisites

**Required tools (on Alpine Linux):**

```bash
apk add alpine-sdk alpine-conf xorriso grub grub-efi squashfs-tools wget
```

### Build Commands


```bash
# Build Alpine ISO
make -C tools/iso-builder/alpine iso

# Output is written to /tmp by default (see BUILD_DIR in Makefile)
```

### Build Steps (Automated)

1. **Download Alpine base** (~5MB mini root filesystem)
2. **Customize system** (apply CodexDNS branding, packages)
3. **Install CodexDNS** (embed binary, web assets, migrations)
4. **Create squashfs** (compressed filesystem)
5. **Configure bootloaders** (GRUB for UEFI, Syslinux for BIOS)
6. **Generate ISO** (bootable hybrid image)

## Installation Process

### Interactive Installation (9 Steps)

1. **Keyboard Layout** - Select keyboard map
2. **Hostname** - Set system hostname
3. **Network** - Configure management interface (DHCP or static)
4. **Timezone** - Select timezone
5. **Disk** - Select target disk and partition
6. **Base System** - Install Alpine Linux base
7. **CodexDNS** - Install application and assets
8. **Admin User** - Create administrator account
9. **Bootloader** - Install GRUB (BIOS or UEFI)

**Total time:** ~5-10 minutes (depending on disk speed)

### Automated Installation (Answerfile)

```bash
# Create answerfile (codexdns.conf)
HOSTNAME="dns-server-01"
MGMT_INTERFACE="eth0"
USE_DHCP="no"
STATIC_IP="10.0.1.100/24"
TARGET_DISK="/dev/sda"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD=""  # Auto-generated

# Place on USB drive or network location
# Boot with: codexdns_answerfile=usb
```

## Testing

### VM Testing Platforms

- ✅ **QEMU/KVM** - BIOS and UEFI modes
- ✅ **VirtualBox** - Generation 1 and 2 VMs
- ✅ **VMware** - Workstation, Fusion, ESXi
- ✅ **Hyper-V** - Windows 10/11 Pro/Enterprise

### Quick Test Commands

```bash
# QEMU BIOS test
make test-bios

# QEMU UEFI test
make test-uefi

# VirtualBox VM
make test-vm
```

### Test Checklist

- [ ] BIOS boot (QEMU, VirtualBox, VMware)
- [ ] UEFI boot (QEMU, VirtualBox, VMware)
- [ ] Interactive installation
- [ ] Automated installation (answerfile)
- [ ] Live boot mode
- [ ] Network connectivity
- [ ] DNS service functionality
- [ ] Web UI access
- [ ] SSH access
- [ ] Firewall rules

## Documentation

| Document | Description |
| -------- | ----------- |
| [tools/iso-builder/README.md](../tools/iso-builder/README.md) | ISO builder documentation |
| [docs/codexdns-os-installation.md](codexdns-os-installation.md) | Complete installation guide |
| [docs/codexdns-os-firewall.md](codexdns-os-firewall.md) | Firewall templates (iptables/nftables) |
| [docs/codexdns-os-vm-testing.md](codexdns-os-vm-testing.md) | VM testing procedures |

## Next Steps

### Phase 1: Testing & Validation ✅ COMPLETE

- [x] Create ISO build system
- [x] Implement installer wizard
- [x] Create branding and themes
- [x] Write documentation
- [x] Create VM test procedures

### Phase 2: Build & Test (Next)

- [ ] Build first ISO image
- [ ] Test on QEMU (BIOS and UEFI)
- [ ] Test on VirtualBox
- [ ] Test on VMware
- [ ] Fix any boot or installation issues

### Phase 3: Assets & Polish

- [ ] Create CodexDNS logo PNG (for GRUB theme)
- [ ] Design boot splash background
- [ ] Create syslinux boot menu graphics
- [ ] Add memtest86+ to boot menu

### Phase 4: Security Hardening

- [ ] Implement read-only root filesystem
- [ ] Create AppArmor/SELinux profiles
- [ ] Add fail2ban pre-configuration
- [ ] Implement first-boot password generation
- [ ] Add SSH key management to first-boot wizard

### Phase 5: Advanced Features

- [ ] Network-based answerfile support (PXE)
- [ ] Multi-language installer (i18n)
- [ ] Custom APK repository (packages.codexdns.io)
- [ ] Live USB with persistence (LBU)
- [ ] Automated backup/restore functionality

### Phase 6: Release

- [ ] Build release ISO (v1.0.0)
- [ ] Generate checksums and signatures
- [ ] Create GitHub release
- [ ] Publish to releases page
- [ ] Update main README with download links

## Known Limitations

1. **No logo/graphics yet** - Placeholder text-only boot menu
2. **No bare-metal testing** - Only VM testing documented
3. **No ARM support** - x86_64 only (could add aarch64 later)
4. **No Windows installer** - Linux-only build environment
5. **Manual GRUB theme assets** - PNG images need to be created

## Technical Debt

- [ ] Add comprehensive error handling to installer
- [ ] Implement rollback on installation failure
- [ ] Add disk health checks before partitioning
- [ ] Improve answerfile validation
- [ ] Add progress bars to installer steps
- [ ] Create automated integration tests
- [ ] Add CI/CD pipeline for ISO builds

## Performance Targets

| Metric | Target | Status |
| ------ | ------ | ------ |
| ISO size | <200MB | ✅ Estimated ~150MB |
| Installed size | <1GB | ✅ Estimated ~500MB |
| Boot time (live) | <30s | ⏳ Needs testing |
| Install time | <10min | ⏳ Needs testing |
| Memory usage (idle) | <512MB | ⏳ Needs testing |
| DNS query latency | <10ms | ⏳ Needs testing |

## Contributing

See main project [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

**ISO-specific contributions:**

- Test on different hardware/VMs
- Report boot or installation issues
- Improve installer UX
- Create boot splash graphics
- Add translations (i18n)
- Write additional documentation

## License

Same as CodexDNS main project (check root LICENSE file).

## Support

- **Issues:** [GitHub Issues](https://github.com/marcuoli/codexdns/issues)
- **Discussions:** [GitHub Discussions](https://github.com/marcuoli/codexdns/discussions)
- **Documentation:** [Wiki](https://github.com/marcuoli/codexdns/wiki)

---

**Last Updated:** January 24, 2026  
**Version:** 1.0.0-dev  
**Status:** Implementation Complete ✅
