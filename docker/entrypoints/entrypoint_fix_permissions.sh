#!/bin/sh

if [ ! -z "$USER_ID" ] && [ ! -z "$GROUP_ID" ]; then
    groupmod -g $GROUP_ID beetle
    usermod -u $USER_ID -g $GROUP_ID beetle > /dev/null 2>&1
    chown -R beetle:beetle /home/beetle
    chown -R beetle:beetle /repo
    chown -R beetle:beetle /logs
fi

# Add extra groups to the beetle user if EXTRA_GROUPS is set
# Format: "group_name1:gid1,group_name2:gid2" e.g., "nas_shares:1001,media:1002"
if [ ! -z "$EXTRA_GROUPS" ]; then
    echo "[Entrypoint] Adding extra groups to beetle user: $EXTRA_GROUPS"
    # Split by comma and iterate
    OLD_IFS="$IFS"
    IFS=','
    for group_spec in $EXTRA_GROUPS; do
        # Validate that the format contains a colon
        case "$group_spec" in
            *:*) ;;
            *)
                echo "[Entrypoint] Warning: Invalid group specification '$group_spec', skipping. Format should be 'group_name:gid'"
                continue
                ;;
        esac
        
        # Split by colon to get group_name and gid
        group_name=$(echo "$group_spec" | cut -d':' -f1)
        gid=$(echo "$group_spec" | cut -d':' -f2)
        
        # Validate that both group_name and gid are provided
        if [ -z "$group_name" ] || [ -z "$gid" ]; then
            echo "[Entrypoint] Warning: Invalid group specification '$group_spec', skipping. Format should be 'group_name:gid'"
            continue
        fi
        
        # Validate group_name against Linux group naming conventions
        case "$group_name" in
            [a-z]*([a-z0-9_-]) ) ;; # valid: starts with a lowercase letter, only allowed chars
            [0-9]*|*[^a-z0-9_-]*)
                echo "[Entrypoint] Warning: Invalid group name '$group_name' in '$group_spec', skipping. Group names should start with a lowercase letter and contain only lowercase letters, digits, underscores, and hyphens"
                continue
                ;;
        esac
        # Validate that gid is a positive integer
        case "$gid" in
            *[!0-9]*)
                echo "[Entrypoint] Warning: GID '$gid' is not a valid positive integer in '$group_spec', skipping"
                continue
                ;;
        esac
        if [ "$gid" -le 0 ] 2>/dev/null; then
            echo "[Entrypoint] Warning: GID '$gid' must be a positive integer in '$group_spec', skipping"
            continue
        fi
        
        # Check if the group already exists
        if getent group "$group_name" > /dev/null 2>&1; then
            existing_gid=$(getent group "$group_name" | cut -d: -f3)
            if [ "$existing_gid" != "$gid" ]; then
                echo "[Entrypoint] Warning: Group '$group_name' exists with GID $existing_gid (expected $gid). Using existing group."
            fi
            echo "[Entrypoint] Group '$group_name' already exists, skipping creation"
        else
            # Create the group with the specified gid
            error_output=$(addgroup -g "$gid" "$group_name" 2>&1)
            add_result=$?
            if [ $add_result -eq 0 ]; then
                echo "[Entrypoint] Created group '$group_name' with gid $gid"
            else
                echo "[Entrypoint] Warning: Failed to create group '$group_name' with gid $gid: $error_output"
                continue
            fi
        fi
        
        # Add beetle user to the group if not already a member
        if id -nG beetle | grep -qw "$group_name"; then
            echo "[Entrypoint] User beetle is already a member of group '$group_name'"
        else
            error_output=$(adduser beetle "$group_name" 2>&1)
            add_result=$?
            if [ $add_result -eq 0 ]; then
                echo "[Entrypoint] Added beetle user to group '$group_name'"
            else
                echo "[Entrypoint] Warning: Failed to add beetle user to group '$group_name': $error_output"
            fi
        fi
    done
    IFS="$OLD_IFS"
fi
