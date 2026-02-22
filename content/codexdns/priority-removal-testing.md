# Priority Field Removal - Testing Checklist

**Build Status**: ✅ Successful  
**Template Generation**: ✅ Successful  
**Migration Files**: ✅ Created

---

## Pre-Migration Verification

Before running the migration, verify current functionality:

- [ ] Login to CodexDNS web UI
- [ ] Navigate to Filter Policies page (`/filter-policies`)
- [ ] Verify existing policies are visible
- [ ] Note current policy count and configuration

---

## Migration Steps

### 1. Backup Database (CRITICAL)
```bash
# Copy the database file before migration
copy codexdns.db codexdns.db.backup.before-priority-removal
```

### 2. Run Migration
```bash
# If using golang-migrate
migrate -path ./migrations -database "sqlite3://codexdns.db" up

# Or if using app's built-in migration
.\bin\codexdns.exe migrate up
```

### 3. Verify Migration Success
```bash
# Check migration status
migrate -path ./migrations -database "sqlite3://codexdns.db" version

# Should show: 000002
```

---

## Post-Migration Testing

### Basic UI Tests

- [ ] **Load Filter Policies Page**
  - Navigate to `/filter-policies`
  - Page loads without errors
  - No Priority column visible in table
  - Policies sorted by created date (newest first)

- [ ] **Create New Policy**
  - Click "New Policy" button
  - Modal opens without errors
  - No Priority input field visible
  - Select filter list (should show domain preview)
  - Select client group
  - Check "Enabled" checkbox
  - Click "Create"
  - Policy created successfully
  - Policy appears in table

- [ ] **Edit Existing Policy**
  - Click edit icon on a policy
  - Modal opens with policy data loaded
  - No Priority field visible
  - Can change filter list
  - Can change client group
  - Can toggle enabled status
  - Click "Update"
  - Policy updated successfully

- [ ] **Delete Policy**
  - Click delete icon on a policy
  - Confirmation modal appears
  - Confirm deletion
  - Policy removed from table

- [ ] **Sort Policies**
  - Click column headers to sort
  - Verify sorting works for:
    - Filter List name
    - Client Group name
    - List Type
    - Status
  - Default sort should be newest first (created_at DESC)

### DNS Filtering Tests

- [ ] **Allowlist Rules Work**
  - Create policy with allowlist
  - Test DNS query for allowed domain
  - Query should be allowed/resolved

- [ ] **Blocklist Rules Work**
  - Create policy with blocklist
  - Test DNS query for blocked domain
  - Query should be blocked (NXDOMAIN or custom response)

- [ ] **Client Group Filtering**
  - Create policy for specific client group
  - Test query from client in group
  - Test query from client not in group
  - Rules should apply only to group members

- [ ] **Quick Block Rules**
  - Navigate to Quick Rules page
  - Add domain to Quick Block
  - Domain should be blocked immediately
  - Check that policy was created

- [ ] **Quick Allow Rules**
  - Navigate to Quick Rules page
  - Add domain to Quick Allow
  - Domain should be allowed immediately
  - Check that policy was created

### API Tests (Optional)

```bash
# Get policy list
curl -X GET http://localhost:8080/api/filter-policies

# Verify response has no "priority" field

# Create policy
curl -X POST http://localhost:8080/filter-policies \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ListIDs[]=1&GroupID=1&IsEnabled=on&_csrf=TOKEN"

# Verify creation succeeds without Priority field
```

---

## Performance Verification

- [ ] **Check Log Files**
  - No errors in `logs/http.log`
  - No errors in `logs/dns.log`
  - No SQL errors in application logs

- [ ] **Monitor DNS Query Performance**
  - Test 100+ DNS queries
  - No performance degradation
  - Cache still functioning

- [ ] **Check Database Size**
  - Database size should be same or slightly smaller
  - No corruption errors

---

## Rollback Testing (Optional but Recommended)

### Test Rollback Procedure

1. **Backup current state**
   ```bash
   copy codexdns.db codexdns.db.backup.after-migration
   ```

2. **Run down migration**
   ```bash
   migrate -path ./migrations -database "sqlite3://codexdns.db" down 1
   ```

3. **Verify rollback**
   - Priority column should be restored
   - All priority values should be 0
   - Old code would need to be restored to use priority again

4. **Re-apply migration**
   ```bash
   migrate -path ./migrations -database "sqlite3://codexdns.db" up
   ```

---

## Known Issues / Expected Behavior Changes

### ✅ Expected Changes (Not Issues)

1. **No Priority column in UI** - This is correct, field was removed
2. **No Priority in API responses** - This is correct, field removed from JSON
3. **Default sort is created_at DESC** - Changed from priority ASC
4. **All priority values would be 0 after rollback** - Cannot recover original values

### ❌ Potential Issues to Watch For

1. **Migration fails** - Check database is not locked, app is stopped
2. **Foreign key errors** - Should not happen, but check logs
3. **Cache not updating** - Restart DNS service if needed
4. **Policy creation fails** - Check browser console for JS errors
5. **Modal doesn't open** - Clear browser cache, check for JS errors

---

## Success Criteria

✅ All tests pass when:

1. Migration completes without errors
2. Filter Policies page loads and displays data
3. Can create new policies without Priority field
4. Can edit existing policies
5. Can delete policies
6. DNS filtering works correctly (allowlist/blocklist)
7. Quick rules work
8. No errors in logs
9. Performance is unchanged

---

## Rollback Plan

If critical issues are found:

1. **Immediate Action**
   ```bash
   # Stop application
   # Restore backup
   copy codexdns.db.backup.before-priority-removal codexdns.db
   
   # Revert code changes
   git revert <commit-hash>
   
   # Rebuild and restart
   go build -o bin\codexdns.exe .\cmd\codexdns
   .\bin\codexdns.exe
   ```

2. **Report Issue**
   - Document the error/issue
   - Check logs for error messages
   - Note which test failed
   - Provide reproduction steps

---

## Cleanup After Successful Testing

Once all tests pass:

- [ ] Keep database backup for 7 days (in case of delayed issues)
- [ ] Update documentation if needed
- [ ] Notify team of changes
- [ ] Monitor production logs for 24-48 hours
- [ ] Remove old backup after confirmation period

---

## Questions?

If you encounter issues during testing:

1. Check `logs/http.log` and `logs/dns.log` for errors
2. Check browser console for JavaScript errors
3. Verify migration was applied: `migrate version`
4. Try restarting the application
5. If all else fails, restore backup and rollback code changes

---

**Last Updated**: 2024-01-XX  
**Migration Version**: 000002  
**Related Documentation**: `docs/priority-field-removal.md`
