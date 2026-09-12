# Environments and remote connections

Use [Settings → Connections](/settings/connections) to connect this client to another environment or make a desktop environment available to another device.

An **environment** is a running CoCo server with its own projects, files, provider installations, and credentials. The agent runs on that environment's machine.

The **host** is the machine that runs the environment. The **client** is the app or browser that connects to it.

The host must remain running and reachable while you work. Pairing does not copy a repository or move an agent session to your current device.

## Select the connection method

| Method              | Use when                                                                   | Requirements                                                          |
| ------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Local desktop       | The project and tools are on this computer.                                | The installed desktop app.                                            |
| **Remote link**     | Another environment already supplies a reachable address and pairing code. | Network access to that address and an unused pairing link.            |
| **SSH**             | The desktop app must connect through an existing SSH account.              | A working SSH configuration and compatible tools on the remote host.  |
| **Tailscale HTTPS** | Both devices use the same private Tailscale network.                       | Tailscale, a usable HTTPS endpoint, and pairing permission.           |
| **T3 Connect**      | A configured build supports the managed connection service.                | A T3 Connect account, a linked environment, and service availability. |

SSH is available only in the desktop app. T3 Connect controls appear only when that service is configured for the build.

## Read this environment's status

**This environment** contains the host's network settings and supported server controls.

**Environment icon** changes the machine icon that connected clients display. **Automatic** uses the detected machine type.

**Network access** reports whether other devices can reach this host. With access off, the environment is limited to this machine.

If **Server update available** appears, the server and client versions differ. Use [Updates](updates.md) before you select the update action.

An **Administrative access** message means your session cannot manage pairing links or authorized clients. Obtain the necessary access from the environment owner.

## Enable direct network access

Use this procedure in the desktop app on the host. Finish active work before a required restart.

1. Open **Settings → Connections**.
2. Turn on **Network access**.
3. Read the restart confirmation.
4. Select **Restart and enable**.
5. After restart, return to **Connections**.
6. Find an address that the receiving device can reach.

The expected result is a displayed network endpoint and the **Authorized clients** section.

An address such as `127.0.0.1` or `localhost` refers to the receiving device itself. It is not suitable for access from another computer.

The receiving device must have a network route to the host. A pairing link does not bypass a firewall or create that route.

To return to local access, turn off **Network access** and confirm **Restart and disable**.

In the web client, network exposure can be read-only. Change it where the server process starts; the page explains when a restart is necessary.

## Create a pairing link

A **pairing link** grants a new client access to an environment. It contains a one-time credential.

1. On the host, open **Connections → Authorized clients**.
2. Select **Create link**.
3. Enter an optional **Client label**.
4. Select **Read only**, **Standard**, or the required individual permissions.
5. Select the form's create action.
6. Select the endpoint that the receiving device can reach.
7. Copy the complete pairing URL, or display its QR code.
8. Open the URL or scan the QR code on the receiving device.

The new client appears under **Authorized clients** after pairing. Use a separate fresh link for each additional device.

The app can copy a new link only from the client that created it while the Connections page remains open. If you leave, create another link if necessary.

Keep pairing URLs and codes out of screenshots and support reports. They grant access to the environment.

## Select pairing permissions

**Read only** selects environment viewing. **Standard** selects the normal set of working permissions. Read the individual selections before you create the link.

| Permission           | Client capability                                  |
| -------------------- | -------------------------------------------------- |
| **View environment** | Read threads, status, diffs, and configuration.    |
| **Operate tasks**    | Start tasks and make changes in the environment.   |
| **Use terminals**    | Create terminals and send input to running shells. |
| **Write reviews**    | Create review comments.                            |
| **View access**      | Read pairing links and authorized clients.         |
| **Manage access**    | Create and revoke access for other clients.        |
| **View relay**       | Read managed connection status.                    |
| **Manage relay**     | Change managed tunnel connections.                 |

At least one permission is required. **Manage access** grants the ability to authorize other devices; it is more than permission to send a chat message.

## Add an environment from a link

Use this procedure on the receiving desktop or web client.

1. Open **Settings → Connections**.
2. Under **Remote environments**, select **Add environment**.
3. Select **Remote link**.
4. Paste the complete pairing URL into **Host**.
5. Make sure **Host** and **Pairing code** contain the expected values.
6. Select **Add environment**.

You can also enter the host and code separately. The full URL fills both fields automatically.

The expected result is a connected environment row. Its projects and threads become available through that environment.

If the link was already used or expired, create a new link on the host. A successfully paired client uses its saved access for future connections.

An HTTPS-hosted web client requires a compatible HTTPS server endpoint. A link to plain HTTP does not become HTTPS through pairing.

## Connect through SSH

SSH authenticates access to a remote machine and creates a network tunnel for the app. Configure working SSH access before you add the environment.

The host must have a compatible Node.js runtime and the required agent provider. Its project directories and credentials remain on that host.

1. In the desktop app, open **Settings → Connections**.
2. Select **Add environment**.
3. Select **SSH**.
4. Enter **SSH host or alias**.
5. If necessary, enter **Username**.
6. If necessary, enter **Port**.
7. Select **Add environment**.

The host list can use aliases from your local SSH configuration. The default SSH port is 22.

CoCo starts or reuses the remote server and opens the tunnel. Wait for the environment row to show a connected state.

If Node is unavailable only through CoCo, compare the remote non-interactive shell with your normal terminal. Version-manager setup can differ between these shells.

If SSH reconnect fails after an app update, use **Connect** once more after the previous attempt ends. Read the reported error if the retry fails.

If you remove an SSH connection, CoCo stops the server it started for that connection. A server that was already running continues to run.

## Use Tailscale HTTPS

Both devices must be connected to the same permitted Tailscale network. Tailscale must be running on the host.

1. On the host, open **Settings → Connections**.
2. Turn on **Tailscale HTTPS**.
3. Read the proposed **HTTPS endpoint**.
4. If necessary, change **HTTPS port** to an unused port.
5. Select **Enable**.
6. After restart, create a pairing link with the Tailscale HTTPS endpoint.
7. Pair the receiving device with that link.

The endpoint uses the host's Tailscale DNS name. Valid port values are 1 through 65535.

If no Tailscale endpoint appears, start Tailscale and restore its network connection. A corporate policy can restrict HTTPS or device access.

To remove the HTTPS route, turn off **Tailscale HTTPS** and confirm. Use the separate **Network access** control to stop ordinary network access.

## Use T3 Connect when available

T3 Connect makes an environment available through a managed tunnel. This avoids manual router forwarding.

1. On the host, sign in to the configured T3 Connect service.
2. Open **Settings → Connections**.
3. Turn on **T3 Connect**.
4. Wait for **T3 Connect linked**.
5. On the receiving device, sign in to the same account.
6. Select the environment from the available remote environments.

If the switch is disabled, read its explanation. Missing sign-in or insufficient relay permission can prevent changes.

**Publish agent activity** is a separate setting for mobile notifications and Live Activities. It can remain on without the managed tunnel.

To remove both functions, turn off **T3 Connect** and **Publish agent activity**. Activity publishing continues if only the tunnel is off.

If the service is not configured for your CoCo build, use direct pairing or SSH. A missing T3 Connect row is not a Jira connection error.

## Use WSL on Windows

WSL is Windows Subsystem for Linux. A WSL environment has separate projects, files, provider installations, and credentials from the Windows environment.

The **WSL backend** control appears only on supported Windows desktop installations.

1. Open **Settings → Connections**.
2. In **WSL backend**, select the required installed distribution.
3. If prompted, select whether to run Windows alongside WSL or use WSL only.
4. Confirm any required restart.

**WSL only** stops the Windows backend. Windows-side projects are unavailable until you turn that option off.

Select **Off** in **WSL backend** to stop the WSL environment. Existing WSL projects and threads remain in the distribution.

A different distribution selection can interrupt sessions on the current distribution. Finish active work before you make that change.

The WSL row in Remote environments can say **Managed above**. Use the WSL control, not a remote Disconnect action, to manage it.

## Balance new threads across machines

**Load balancing** can select a machine for new threads in projects grouped across environments. It defaults to off.

1. Connect at least two eligible environments.
2. Open **Connections → Load balancing**.
3. Turn on **Automatically balance load**.
4. Set each machine's preference.

| Preference      | Meaning                                                   |
| --------------- | --------------------------------------------------------- |
| **Prefer**      | Favor this machine when suitable capacity is available.   |
| **Normal**      | Use the normal preference. This is the initial selection. |
| **Less often**  | Reduce this machine's share of automatic selections.      |
| **Manual only** | Exclude this machine from automatic selections.           |

These values are preferences, not fixed percentages. CoCo also considers available machine resources.

Existing threads stay on their original environment. If you select a specific machine, branch, or worktree, the draft stays on that machine.

If automatic selection cannot find an available machine, select one manually. The load-balancing preferences belong to this client.

## Reconnect or remove a saved environment

The environment row shows connection status and any error. Select **Connect** to retry a disconnected saved environment.

Use **Disconnect** on a connected row or **Remove** on a disconnected row to remove that connection from this client.

Removal does not delete the host's project files or conversation database. To add the environment again, obtain a new pairing link or repeat SSH setup.

If the row shows a version mismatch, use the offered server update procedure. If it shows **Copy trace ID**, include that identifier in a support report.

## Revoke another device's access

Use the host's **Authorized clients** section.

| Action                               | Effect                                                       |
| ------------------------------------ | ------------------------------------------------------------ |
| **Revoke** on an unused pairing link | Prevents a new client from using that link.                  |
| **Revoke** on an authorized client   | Removes that client's existing access.                       |
| **Revoke others**                    | Removes other client sessions while keeping the current one. |

To remove an already paired device, use the authorized-client row. A revoked link alone does not revoke the device's session.

After revocation, create a new pairing link if that device must connect again.

## Resolve connection failures

| Symptom                                 | Action                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| An environment is offline               | Make sure the host is running, awake, and connected to the required network.                                |
| Pairing fails immediately               | Confirm the endpoint and use a fresh, unused pairing code.                                                  |
| The link contains localhost             | Select a host endpoint reachable from the receiving device.                                                 |
| The browser rejects the connection      | Confirm that the endpoint uses the protocol required by the web client, including HTTPS where required.     |
| SSH cannot find Node or the provider    | Make sure the remote executable paths and non-interactive shell configuration identify the installed tools. |
| Provider settings are read-only         | Obtain a session with the necessary environment permissions.                                                |
| WSL projects disappear                  | Re-enable the distribution that owns those projects.                                                        |
| A previously paired device loses access | Confirm that its session was not revoked, then pair again if necessary.                                     |

For persistent failures, record the exact error, affected environment, app version, and trace ID. Use [Troubleshooting](troubleshooting.md) for more diagnosis.
