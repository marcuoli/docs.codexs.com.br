---
title: "Package Formats"
description: "Comparison of RPM, DEB, APK, and Docker packaging options."
weight: 20
---

# Packaging Comparison: APK (Baseline) vs DEB vs RPM

## Executive Summary

| Feature | APK (Alpine) | DEB (Debian/Ubuntu) | RPM (RHEL/Fedora) |
|---------|--------------|---------------------|-------------------|
| **Dependencies** |  |  |  |
| - redis | ✅ redis | ✅ redis-server >= 6.0 | ✅ redis >= 6.0 |
| - sqlite | ✅ sqlite-libs | ✅ sqlite3 >= 3.0 | ✅ sqlite >= 3.0 |
| - tzdata | ✅ tzdata | ✅ tzdata | ❌ **MISSING** |
| - chrony | ✅ chrony | ✅ chrony | ❌ **MISSING** |
| **Build Script** |  |  |  |
| - Clean old packages | ✅ rm -f *.apk | ✅ rm -f *.deb | ❌ **MISSING** |
| **Service/Init** |  |  |  |
| - Separate logs | ✅ stdout/stderr | ✅ stdout/stderr | ✅ stdout/stderr |
| - Timezone extract | ✅ start_pre() | ✅ ExecStartPre | ✅ ExecStartPre |
| - Configurable paths | ✅ /etc/conf.d | N/A (systemd) | N/A (systemd) |
| **Post-Install** |  |  |  |
| - Set ownership | ✅ chown | ✅ chown | ✅ chown |
| - Session secret | ✅ Random gen | ✅ Random gen | ✅ Random gen |
| - Enable chrony | ✅ rc-update | ✅ systemctl | ❌ **MISSING** |
| - Enable service | ✅ rc-update | ✅ deb-systemd | ✅ systemctl |
| - Start service | ✅ rc-service | ✅ deb-systemd | ✅ systemctl |

## Detailed Comparison

### 1. Dependencies

#### APK (Alpine) - BASELINE ✅
```bash
depends="redis sqlite-libs tzdata chrony"
```

#### DEB (Debian/Ubuntu) ✅
```debian-control
Depends: ${shlibs:Depends},
         ${misc:Depends},
         redis-server (>= 6.0),
         sqlite3 (>= 3.0),
         tzdata,
         chrony
```
**Status:** ✅ Fully aligned with APK baseline

#### RPM (RHEL/Fedora) ❌
```spec
Requires:       redis >= 6.0
Requires:       sqlite >= 3.0
```
**Issues:**
- ❌ Missing `tzdata` dependency
- ❌ Missing `chrony` dependency

**Required Fix:**
```spec
Requires:       redis >= 6.0
Requires:       sqlite >= 3.0
Requires:       tzdata
Requires:       chrony
```

---

### 2. Build Scripts

#### APK (Alpine) - BASELINE ✅
```bash
# tools/packaging/alpine/build-apk.sh
OUTPUT_DIR="/mnt/f/temp/codexdns/apk"
mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR"/codexdns-*.apk    # ← Clean old packages
```

#### DEB (Debian/Ubuntu) ✅
```bash
# tools/packaging/debian/build-deb.sh
OUTPUT_DIR="/mnt/f/temp/codexdns/deb"
mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR"/codexdns_*.deb    # ← Clean old packages
```
**Status:** ✅ Fully aligned with APK baseline

#### RPM (RHEL/Fedora) ❌
```bash
# tools/packaging/build-rpm.sh
OUTPUT_DIR="/mnt/f/temp/codexdns/rpm"
mkdir -p "$OUTPUT_DIR"
# ❌ Missing cleanup of old RPM files
```

**Required Fix:**
```bash
OUTPUT_DIR="/mnt/f/temp/codexdns/rpm"
mkdir -p "$OUTPUT_DIR"

# Clean old RPM files before copying new ones
rm -f "$OUTPUT_DIR"/codexdns-*.rpm
rm -f "$OUTPUT_DIR"/codexdns-*.src.rpm
```

---

### 3. Service Configuration Files

#### APK (Alpine - OpenRC) - BASELINE ✅
```bash
# tools/packaging/alpine/codexdns.initd
output_log="${CODEXDNS_LOG_DIR}/codexdns-stdout.log"
error_log="${CODEXDNS_LOG_DIR}/codexdns-stderr.log"

start_pre() {
    # Extract timezone from config.json and set TZ environment variable
    if [ -f "${CODEXDNS_CONFIG_FILE}" ]; then
        TIMEZONE=$(grep -o '"timezone"[[:space:]]*:[[:space:]]*"[^"]*"' "${CODEXDNS_CONFIG_FILE}" | sed 's/.*"\([^"]*\)"/\1/')
        if [ -n "$TIMEZONE" ]; then
            export TZ="$TIMEZONE"
            einfo "Setting timezone to $TIMEZONE"
        fi
    fi
}
```

Features:
- ✅ Separate stdout/stderr logs
- ✅ Timezone extraction from config.json
- ✅ Configurable paths via `/etc/conf.d/codexdns`

#### DEB (Debian/Ubuntu - systemd) ✅
```systemd-conf
# tools/packaging/debian/codexdns.service
StandardOutput=append:/opt/codexdns/logs/codexdns-stdout.log
StandardError=append:/opt/codexdns/logs/codexdns-stderr.log

ExecStartPre=/bin/sh -c 'if [ -f /opt/codexdns/config/config.json ]; then TZ=$(grep -o "\"timezone\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" /opt/codexdns/config/config.json | sed "s/.*\"\([^\"]*\)\"/\\1/"); [ -n "$TZ" ] && echo "TZ=$TZ" > /run/codexdns-env; fi'
EnvironmentFile=-/run/codexdns-env
```
**Status:** ✅ Fully aligned with APK baseline (systemd-equivalent)

#### RPM (RHEL/Fedora - systemd) ✅
```systemd-conf
# tools/packaging/codexdns.service
StandardOutput=append:/opt/codexdns/logs/codexdns-stdout.log
StandardError=append:/opt/codexdns/logs/codexdns-stderr.log

ExecStartPre=/bin/sh -c 'if [ -f /opt/codexdns/config/config.json ]; then TZ=$(grep -o "\"timezone\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" /opt/codexdns/config/config.json | sed "s/.*\"\([^\"]*\)\"/\\1/"); [ -n "$TZ" ] && echo "TZ=$TZ" > /run/codexdns-env; fi'
EnvironmentFile=-/run/codexdns-env
```
**Status:** ✅ Fully aligned with APK baseline (systemd-equivalent)

**Note:** Both DEB and RPM use the **same** `codexdns.service` file (tools/packaging/codexdns.service for RPM, tools/packaging/debian/codexdns.service for DEB)

---

### 4. Post-Installation Scripts

#### APK (Alpine) - BASELINE ✅
```bash
# tools/packaging/alpine/codexdns.post-install

# Set ownership
chown -R codexdns:codexdns /var/lib/codexdns
chown -R codexdns:codexdns /var/log/codexdns
chown -R root:codexdns /etc/codexdns

# Generate session secret
if grep -q "CHANGE_THIS_IN_PRODUCTION_TO_A_RANDOM_STRING" /etc/codexdns/config.json; then
    SESSION_SECRET=$(head -c 32 /dev/urandom | hexdump -ve '1/1 "%.2x"')
    sed -i "s/CHANGE_THIS_IN_PRODUCTION_TO_A_RANDOM_STRING/$SESSION_SECRET/g" /etc/codexdns/config.json
fi

# Enable chrony service
if command -v rc-update >/dev/null 2>&1 && command -v chronyd >/dev/null 2>&1; then
    rc-update add chronyd default 2>/dev/null || true
fi

# Enable and start codexdns service
rc-update add codexdns default 2>/dev/null || true
rc-service codexdns start 2>/dev/null || true
```

#### DEB (Debian/Ubuntu) ✅
```bash
# tools/packaging/debian/postinst

# Set ownership
chown -R codexdns:codexdns /opt/codexdns
chmod 0770 /opt/codexdns/config
chmod 0770 /opt/codexdns/data
chmod 0770 /opt/codexdns/logs

# Generate session secret
if grep -q "CHANGE_THIS_IN_PRODUCTION_TO_A_RANDOM_STRING" /opt/codexdns/config/config.json; then
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
    sed -i "s/CHANGE_THIS_IN_PRODUCTION_TO_A_RANDOM_STRING/$SESSION_SECRET/g" /opt/codexdns/config/config.json
fi

# Enable chrony service
if [ -d /run/systemd/system ]; then
    systemctl enable chrony >/dev/null 2>&1 || true
fi

# Enable and start codexdns service
deb-systemd-helper enable codexdns.service >/dev/null || true
if [ -d /run/systemd/system ]; then
    systemctl --system daemon-reload >/dev/null || true
    deb-systemd-invoke start codexdns.service >/dev/null || true
fi
```
**Status:** ✅ Fully aligned with APK baseline (systemd-equivalent)

#### RPM (RHEL/Fedora) ❌
```spec
# tools/packaging/codexdns.spec (%post section)

# Set ownership
chown -R %{name}:%{name} /opt/%{name}
chmod 0770 /opt/%{name}/config
chmod 0770 /opt/%{name}/data
chmod 0770 /opt/%{name}/logs

# Generate session secret
if grep -q "CHANGE_THIS_IN_PRODUCTION_TO_A_RANDOM_STRING" /opt/%{name}/config/config.json; then
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
    sed -i "s/CHANGE_THIS_IN_PRODUCTION_TO_A_RANDOM_STRING/$SESSION_SECRET/g" /opt/%{name}/config/config.json
fi

# ❌ Missing: Enable chrony service

# Enable and start codexdns service
systemctl enable %{name}.service >/dev/null 2>&1 || true
systemctl start %{name}.service >/dev/null 2>&1 || true
```

**Issue:**
- ❌ Missing chrony service enablement

**Required Fix:**
```spec
# Enable chrony service for NTP time synchronization
systemctl enable chronyd >/dev/null 2>&1 || true

# Enable and start codexdns service
systemctl enable %{name}.service >/dev/null 2>&1 || true
systemctl start %{name}.service >/dev/null 2>&1 || true
```

---

### 5. Configuration File Hierarchy

#### APK (Alpine) - BASELINE ✅
```bash
# /etc/conf.d/codexdns - User-overridable init script settings
: ${CODEXDNS_CONFIG_FILE:="/etc/codexdns/config.json"}  # Path to config.json
: ${CODEXDNS_BIN:="/usr/bin/codexdns"}                  # Binary location
: ${CODEXDNS_WORK_DIR:="/usr/share/codexdns"}           # Working directory
```

#### DEB/RPM (systemd) N/A
- Systemd services don't use `/etc/conf.d/` equivalents
- Configuration is directly in service files
- Paths are hardcoded in systemd unit files
- **This is acceptable** - systemd convention differs from OpenRC

---

## Summary of Required Fixes

### RPM Packaging Needs 3 Fixes:

1. **Add missing dependencies to `codexdns.spec`:**
   ```spec
   Requires:       redis >= 6.0
   Requires:       sqlite >= 3.0
   Requires:       tzdata
   Requires:       chrony
   ```

2. **Add cleanup to `build-rpm.sh` before copying packages:**
   ```bash
   # Clean old RPM files before copying new ones
   rm -f "$OUTPUT_DIR"/codexdns-*.rpm
   rm -f "$OUTPUT_DIR"/codexdns-*.src.rpm
   ```

3. **Add chrony enablement to `codexdns.spec` %post section:**
   ```spec
   # Enable chrony service for NTP time synchronization
   systemctl enable chronyd >/dev/null 2>&1 || true
   
   # Enable and start service
   systemctl enable %{name}.service >/dev/null 2>&1 || true
   systemctl start %{name}.service >/dev/null 2>&1 || true
   ```

### DEB Packaging: ✅ Complete
All Alpine improvements have been successfully applied to DEB packaging.

---

## Implementation Priority

1. **HIGH:** RPM dependencies (tzdata, chrony) - Affects runtime functionality
2. **HIGH:** RPM chrony enablement - Affects time synchronization
3. **MEDIUM:** RPM build script cleanup - Quality of life, prevents confusion

---

## Notes

- Alpine uses FHS paths: `/etc`, `/var/lib`, `/var/log`, `/usr/bin`, `/usr/share`
- DEB/RPM use `/opt/codexdns` hierarchy (non-FHS but common for third-party apps)
- Both approaches are valid and follow their respective ecosystem conventions
- Systemd services (DEB/RPM) share identical `codexdns.service` file
- Alpine OpenRC init script is fundamentally different but functionally equivalent
