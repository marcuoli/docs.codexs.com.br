---
title: "Testing Filter Rules"
description: "How to test and validate your filter rules."
weight: 40
---

# Quick Block/Allow Feature - Manual Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing the Quick Block/Allow feature in CodexDNS.

---

## Prerequisites

### 1. Start CodexDNS Server
```powershell
.\bin\codexdns.exe
```

### 2. Login to Web UI
- Open browser: `http://localhost:8080`
- Login with admin credentials
- Verify you see the dashboard

### 3. Generate DNS Traffic
To test the feature, you need live DNS queries. Options:

**Option A: Use your own DNS queries**
```powershell
# Configure your system to use CodexDNS as DNS server
# Windows: Set DNS to 127.0.0.1 in network adapter settings
```

**Option B: Use nslookup for testing**
```powershell
nslookup example.com 127.0.0.1
nslookup google.com 127.0.0.1
nslookup test.com 127.0.0.1
```

**Option C: Use dig (if installed)**
```powershell
dig @127.0.0.1 example.com
```

---

## Test Cases

### TEST 1: Verify Pages Load ✅

**Steps:**
1. Navigate to **Filtering → Live Queries** in sidebar
2. Verify page loads with streaming DNS queries
3. Verify table has **10 columns** including **"Actions"** as the last column
4. Verify each query row has **4 action buttons**:
   - 🛡️ Block Domain (shield-slash icon)
   - ✅ Allow Domain (shield-check icon)  
   - 🚫 Block Client (shield-slash icon)
   - ✓ Allow Client (shield-check icon)

5. Navigate to **Filtering → Quick Rules** in sidebar
6. Verify page loads with **4 tabs**:
   - Blocked Domains
   - Allowed Domains
   - Blocked Clients
   - Allowed Clients
7. Verify **empty states** appear (search icons with messages)

**Expected Result:**
- Both pages load without errors
- All UI elements appear correctly
- No JavaScript console errors

---

### TEST 2: Quick Block Domain ⚡

**Steps:**
1. Go to **Live Queries** page
2. Wait for a DNS query to appear (or generate one with `nslookup example.com 127.0.0.1`)
3. Click the **🛡️ Block Domain** button for `example.com`
4. Verify confirmation dialog appears:
   - Title: "Block Domain"
   - Message: "Block all queries for example.com?"
   - Buttons: Cancel, Block
5. Click **Block** button
6. Verify success notification/toast appears
7. Navigate to **Quick Rules → Blocked Domains** tab
8. Verify `example.com` appears in the list
9. Perform DNS query: `nslookup example.com 127.0.0.1`

**Expected Result:**
- Confirmation dialog appears with correct domain name
- Success message after blocking
- Domain appears in Quick Rules → Blocked Domains
- DNS query for `example.com` returns **blocked response** (NXDOMAIN or configured block IP)

**Database Verification:**
```powershell
# Run automated test script
.\scripts\test-quick-rules.ps1
```
Look for `example.com` in TEST 6 output (Quick Block Rules).

---

### TEST 3: Quick Allow Domain ⚡

**Prerequisites:**
- Have a domain that's normally blocked by a blocklist (or use Quick Block to block one first)

**Steps:**
1. Quick Block `test.com` (follow TEST 2)
2. Verify `test.com` queries are blocked: `nslookup test.com 127.0.0.1`
3. Go back to **Live Queries** page
4. Generate query for `test.com`: `nslookup test.com 127.0.0.1`
5. Click **✅ Allow Domain** button for `test.com`
6. Verify confirmation dialog:
   - Title: "Allow Domain"
   - Message: "Allow all queries for test.com?"
7. Click **Allow** button
8. Verify success notification
9. Navigate to **Quick Rules → Allowed Domains** tab
10. Verify `test.com` appears in the list
11. Perform DNS query: `nslookup test.com 127.0.0.1`

**Expected Result:**
- Confirmation dialog shows domain name
- Success message appears
- Domain appears in Quick Rules → Allowed Domains
- DNS query for `test.com` now **resolves normally** (allowlist overrides blocklist)
- This verifies **two-pass evaluation**: Allow lists checked first!

---

### TEST 4: Quick Block Client 🚫

**Steps:**
1. Go to **Live Queries** page
2. Note a client IP making queries (e.g., `192.168.1.100`)
3. Click **🚫 Block Client** button for that IP
4. Verify confirmation dialog shows:
   - Title: "Block Client"
   - Message: "Block all queries from 192.168.1.100 (hostname)?"
5. Click **Block** button
6. Verify success notification
7. Navigate to **Quick Rules → Blocked Clients** tab
8. Verify client appears with **IP address displayed**
9. From that client IP, try any DNS query: `nslookup google.com`

**Expected Result:**
- Confirmation shows IP and hostname
- Success message appears
- Client IP appears in Quick Rules → Blocked Clients
- **ALL** DNS queries from that client are now blocked (regardless of domain)

**Database Verification:**
Check TEST 8 output for client-based rules with pattern `__client:192.168.1.100__`

---

### TEST 5: Quick Allow Client ✓

**Prerequisites:**
- Client must be blocked first (from TEST 4)

**Steps:**
1. Verify client `192.168.1.100` is blocked (queries fail)
2. Go to **Live Queries** page
3. Generate query from blocked client
4. Click **✓ Allow Client** button for `192.168.1.100`
5. Verify confirmation dialog:
   - Title: "Allow Client"
   - Message: "Allow all queries from 192.168.1.100?"
6. Click **Allow** button
7. Verify success notification
8. Navigate to **Quick Rules → Allowed Clients** tab
9. Verify client appears in the list
10. From client, perform DNS query: `nslookup google.com`

**Expected Result:**
- Confirmation shows client info
- Success message appears
- Client appears in Quick Rules → Allowed Clients
- DNS queries from client now **resolve normally** (allowlist overrides blocklist)

---

### TEST 6: Delete Rules 🗑️

**Steps:**
1. Go to **Quick Rules** page
2. Switch to **Blocked Domains** tab
3. Find a blocked domain (e.g., `example.com` from TEST 2)
4. Click **Delete** button (trash icon)
5. Verify confirmation dialog:
   - Title: "Delete Rule"
   - Message shows domain/client pattern
6. Click **Confirm** button
7. Verify rule disappears from list
8. If no more rules, verify **empty state** appears
9. Perform DNS query for deleted domain: `nslookup example.com 127.0.0.1`
10. Repeat for other tabs (Allowed Domains, Blocked/Allowed Clients)

**Expected Result:**
- Confirmation dialog before deletion
- Rule disappears after confirmation
- Empty state appears when no rules remain
- Deleted rule **no longer has effect** (blocked domain now resolves, allowed domain can be blocked by other lists)

---

### TEST 7: Two-Pass Evaluation Logic 🎯

**This is the most important test - verifies allowlist precedence!**

**Steps:**
1. Quick Block `precedence-test.com` (TEST 2 steps)
2. Verify it's blocked: `nslookup precedence-test.com 127.0.0.1`
   - **Expected: NXDOMAIN or block response**
3. Quick Allow same domain `precedence-test.com` (TEST 3 steps)
4. Verify it now resolves: `nslookup precedence-test.com 127.0.0.1`
   - **Expected: Normal resolution** (allowlist wins!)
5. Navigate to **Quick Rules** page
6. Verify domain appears in BOTH:
   - Blocked Domains tab
   - Allowed Domains tab
7. Go to **Allowed Domains** tab
8. Delete the allow rule for `precedence-test.com`
9. Verify it's blocked again: `nslookup precedence-test.com 127.0.0.1`
   - **Expected: NXDOMAIN or block response** (blocklist now applies)

**Expected Result:**
- **Step 2**: Domain is blocked (blocklist active)
- **Step 4**: Same domain now resolves (allowlist overrides blocklist)
- **Step 9**: After deleting allow rule, domain is blocked again (blocklist applies)
- This proves: **Allowlist → Blocklist → Default Allow** evaluation order!

---

### TEST 8: UI/UX Validation 🎨

**Steps:**
1. Verify action button icons are correct:
   - Block Domain: shield with slash
   - Allow Domain: shield with checkmark
   - Block Client: shield with slash
   - Allow Client: shield with checkmark
2. Test confirmation dialogs:
   - Clear titles
   - Descriptive messages showing domain/IP
   - Cancel and action buttons
3. Verify success/error notifications:
   - Success: green toast/banner
   - Errors: red toast/banner with helpful message
4. Test Quick Rules page tabs:
   - Click each tab, verify content switches
   - Active tab is highlighted
5. Test empty states:
   - Clear icons and messages
   - Helpful instructions (e.g., "Use Quick Block button...")
6. Test delete confirmations:
   - Dialog before deletion
   - Shows what will be deleted
7. Test responsive design:
   - Resize browser window
   - Test on mobile viewport (F12 → mobile view)
   - Verify tables scroll horizontally if needed

**Expected Result:**
- All icons display correctly
- Dialogs are clear and informative
- Notifications provide feedback
- Tabs switch smoothly
- Empty states are helpful
- UI works on mobile and desktop

---

### TEST 9: Error Handling ⚠️

**Steps:**
1. **Duplicate Block**: Block same domain twice
   - Block `duplicate.com`
   - Try to block `duplicate.com` again
   - **Expected**: Success (idempotent) or friendly message
2. **Duplicate Allow**: Allow same domain twice
   - Allow `test.com`
   - Try to allow `test.com` again
   - **Expected**: Success (idempotent) or friendly message
3. **Invalid Domain** (if validation exists):
   - Try patterns like `invalid..domain`, `@#$%`
   - **Expected**: Validation error or graceful handling
4. **Invalid IP** (if validation exists):
   - Try IPs like `999.999.999.999`, `not-an-ip`
   - **Expected**: Validation error or graceful handling
5. **Check browser console** (F12):
   - Look for JavaScript errors
   - Should be clean (no red errors)
6. **Check server logs**:
   - Look for unexpected errors or stack traces
   - Normal operation should log actions only

**Expected Result:**
- Duplicate operations handled gracefully (no crashes)
- Invalid inputs rejected with friendly messages
- No JavaScript console errors
- Server logs show only expected messages

---

### TEST 10: Database Verification 🔍

**Run Automated Test Script:**
```powershell
.\scripts\test-quick-rules.ps1
```

**Manual Database Checks:**

**Check Quick Lists:**
```sql
SELECT id, name, is_custom, created_at 
FROM filter_lists 
WHERE name IN ('__Quick_Block_List__', '__Quick_Allow_List__');
```
**Expected:**
- Both lists exist
- `is_custom = 1` (true)

**Check Quick Rules:**
```sql
SELECT fr.id, fr.pattern, fr.rule_type, fl.name
FROM filter_rules fr
JOIN filter_lists fl ON fl.id = fr.list_id
WHERE fl.name IN ('__Quick_Block_List__', '__Quick_Allow_List__');
```
**Expected:**
- All quick blocked/allowed domains appear
- Client rules have pattern `__client:<ip>__`

**Check Policies:**
```sql
SELECT fp.id, fp.group_id, fp.list_id, fl.name
FROM filter_policies fp
JOIN filter_lists fl ON fl.id = fp.list_id
WHERE fp.group_id = 1
  AND fl.name IN ('__Quick_Block_List__', '__Quick_Allow_List__');
```
**Expected:**
- Policies exist for Quick Lists
- `group_id = 1` (All Clients group)

**Check All Clients Group:**
```sql
SELECT id, name, description FROM client_groups WHERE id = 1;
```
**Expected:**
- Group exists with ID = 1
- Name = "All Clients"

---

## Quick Test Matrix

| Test | Feature | Status | Notes |
|------|---------|--------|-------|
| 1 | Pages Load | ☐ | Live Queries + Quick Rules UI |
| 2 | Block Domain | ☐ | Blocks DNS queries |
| 3 | Allow Domain | ☐ | Overrides blocklists |
| 4 | Block Client | ☐ | Blocks all client queries |
| 5 | Allow Client | ☐ | Overrides client blocks |
| 6 | Delete Rules | ☐ | Removes rules, restores default |
| 7 | Two-Pass Logic | ☐ | Allowlist → Blocklist → Default |
| 8 | UI/UX | ☐ | Icons, dialogs, responsive |
| 9 | Error Handling | ☐ | Duplicates, invalid inputs |
| 10 | Database | ☐ | Run automated script |

---

## Test Data Cleanup

After testing, you may want to clean up test data:

```sql
-- Delete all Quick Block rules
DELETE FROM filter_rules 
WHERE list_id IN (
    SELECT id FROM filter_lists WHERE name = '__Quick_Block_List__'
);

-- Delete all Quick Allow rules
DELETE FROM filter_rules 
WHERE list_id IN (
    SELECT id FROM filter_lists WHERE name = '__Quick_Allow_List__'
);

-- Or delete the entire Quick Lists (will be recreated on next use)
DELETE FROM filter_policies 
WHERE list_id IN (
    SELECT id FROM filter_lists 
    WHERE name IN ('__Quick_Block_List__', '__Quick_Allow_List__')
);

DELETE FROM filter_lists 
WHERE name IN ('__Quick_Block_List__', '__Quick_Allow_List__');
```

---

## Troubleshooting

### Issue: Buttons don't appear on Live Queries page
- **Check**: Browser console for JavaScript errors
- **Check**: Template file `querystream.templ` has Actions column
- **Fix**: Clear browser cache, restart server

### Issue: Rules don't block/allow as expected
- **Check**: Database verification (TEST 10)
- **Check**: Server logs for filter evaluation
- **Debug**: Run `.\scripts\test-quick-rules.ps1` to verify DB state

### Issue: Confirmation dialogs don't appear
- **Check**: Browser JavaScript console
- **Check**: Alpine.js is loaded (network tab)
- **Fix**: Hard refresh browser (Ctrl+F5)

### Issue: Empty states don't disappear after adding rules
- **Check**: Browser console for errors
- **Fix**: Refresh page or check Alpine.js state

---

## Success Criteria

✅ **All 10 tests pass**  
✅ **No JavaScript console errors**  
✅ **No unexpected server errors**  
✅ **Database state matches UI state**  
✅ **Two-pass evaluation works correctly**  
✅ **UI is responsive and user-friendly**

---

## Reporting Issues

If you find bugs, document:
1. **Test case** that failed
2. **Steps to reproduce**
3. **Expected vs actual result**
4. **Browser console errors** (F12)
5. **Server logs** (relevant excerpts)
6. **Database state** (run automated script)
7. **Screenshots** (if applicable)
