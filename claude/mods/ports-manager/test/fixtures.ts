// Invented `lsof -nP -iTCP -sTCP:LISTEN` output in the macOS layout: made-up pids and device addresses, user `dev`.
export const LSOF = `COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
ControlCe  9124 dev     9u  IPv4 0x0000000000000001      0t0  TCP *:7000 (LISTEN)
ControlCe  9124 dev    11u  IPv4 0x0000000000000002      0t0  TCP *:5000 (LISTEN)
ControlCe  9124 dev    12u  IPv6 0x0000000000000003      0t0  TCP *:5000 (LISTEN)
com.docke  9201 dev    20u  IPv4 0x0000000000000004      0t0  TCP *:2375 (LISTEN)
node      81234 dev    23u  IPv4 0x0000000000000005      0t0  TCP 127.0.0.1:5173 (LISTEN)
node      81234 dev    24u  IPv6 0x0000000000000006      0t0  TCP [::1]:5173 (LISTEN)
node      81300 dev    25u  IPv4 0x0000000000000007      0t0  TCP *:6006 (LISTEN)
dotnet    81400 dev    26u  IPv6 0x0000000000000008      0t0  TCP [::1]:5001 (LISTEN)
nx        81500 dev    27u  IPv4 0x0000000000000009      0t0  TCP 127.0.0.1:4300 (LISTEN)
Python    81600 dev    28u  IPv4 0x000000000000000a      0t0  TCP *:8000 (LISTEN)
rapportd   9680 dev    12u  IPv4 0x000000000000000b      0t0  TCP *:57435 (LISTEN)
postgres   9694 dev     7u  IPv4 0x000000000000000c      0t0  TCP 127.0.0.1:5432 (LISTEN)
rapportd   9681 root   11u  IPv4 0x000000000000000d      0t0  TCP *:57434 (LISTEN)
Google\\x20Chrome 9777 dev 30u IPv4 0x000000000000000e 0t0 TCP *:9222 (LISTEN)
`

// `ps -axo pid=,ppid=,command=`: this session's `ps` (pid 4300) is a child of the host (4242), which was started by a shell (4100).
export const PS = ` 1 0 /sbin/launchd
 4100 1 /bin/zsh
 4242 4100 claude
 4300 4242 ps -axo pid=,ppid=,command=
 81234 1 node vite
`
