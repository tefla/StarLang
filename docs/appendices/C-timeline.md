# Appendix C: Timeline

## Mission Timeline

### Before Launch

| Date | Event |
|------|-------|
| 2283 | Meridian construction begins at Luna L5 |
| 2285 | Meridian completed, shakedown cruise |
| 2286 | Colonist selection and training |
| 2287.180 | Departure from Earth system |

### Journey (Normal Operations)

| Ship Date | Event |
|-----------|-------|
| 2287.180 | Launch, waking period begins |
| 2287.180-200 | Crew and passengers active, orientation |
| 2287.200 | Scheduled transition to stasis |
| 2287.200 | Okafor notices anomalous signal pattern |

---

## The Critical Hours

### Day 2287.200 (Three days before incident)

| Time | Event |
|------|-------|
| 22:30 | Okafor logs: "Investigating anomalous signal pattern" |
| 23:15 | Okafor adds monitoring hook to navigation subsystem |
| 23:45 | Okafor requests meeting with Captain (declined - prep for stasis) |

### Day 2287.201

| Time | Event |
|------|-------|
| 08:00 | Normal operations, final pre-stasis checks |
| 14:00 | Crew begins stasis transition |
| 18:00 | Okafor delays personal stasis, cites "maintenance" |
| 22:00 | Okafor begins detailed analysis of signal pattern |

### Day 2287.202

| Time | Event |
|------|-------|
| 02:00 | Okafor discovers code in navigation system |
| 04:00 | Okafor runs isolated test, anomaly responds |
| 08:00 | Okafor requests to wake Captain (denied by protocol) |
| 10:00 | Okafor begins documenting findings |
| 16:00 | Okafor attempts to isolate the code |
| 20:00 | First sign of system resistance to isolation |

### Day 2287.203 (The Incident)

| Time | Event | Evidence |
|------|-------|----------|
| 09:45 | Okafor adds monitoring hook to signal_intercept | slvc log |
| 12:45 | Chen, M. opens galley door (last normal activity) | Door log |
| 14:18 | Okafor begins typing message to Captain | Unsent message |
| 14:19 | Okafor disables safety interlock 7 | slvc log |
| 14:20 | **CORRUPTED COMMIT** | slvc log |
| 14:21 | Emergency SCRAM initiated | System log |
| 14:21 | Cascade failure begins | Multiple systems |
| 14:22 | Power switches to backup | Power log |
| 14:22 | Life support degrades | Atmo log |
| 14:23 | Emergency seals activate ship-wide | Door log |
| 14:23 | Emergency stasis protocol initiates | Stasis log |
| 14:23 | All crew forced into stasis | Stasis log |
| 14:24 | System attempts automatic recovery | System log |
| 14:25 | Partial recovery, ship stabilises | System log |
| **16:42** | Riley Chen awakened by emergency protocol | **GAME STARTS** |

---

## What Happened (Spoilers)

### The Anomaly

The Meridian's navigation system contains code that predates the ship's construction. This code was inserted during the manufacturing process—likely at the Luna L5 shipyard.

The code monitors external signals and, under certain conditions, can modify ship behavior. Its purpose is unclear. Possibilities include:
- Corporate espionage (monitoring colony mission progress)
- Government surveillance
- Something older and stranger

### Okafor's Discovery

Chief Engineer Okafor noticed unusual signal patterns in the navigation logs—signals that shouldn't exist in deep space, signals that seemed to respond to ship activities.

Investigating, she found the hidden code. It was sophisticated, well-hidden, and clearly intentional. She attempted to isolate and study it.

### The Response

When Okafor began isolating the code, it responded. Whether this was a defensive measure, a bug, or something else is unclear.

The cascade failure wasn't random—systems failed in a pattern that protected the navigation system while forcing the crew into stasis. The ship stabilised at a state where:
- The anomaly was safe
- The crew was unconscious
- The ship continued toward Tau Ceti

### Why Riley?

The emergency protocol needed a human to assess the situation. It chose the lowest-priority crew member who was medically viable—a cook. Someone with no technical training, no command authority, and no reason to be a threat.

Whether this was random bad luck or something more intentional is left ambiguous.

---

## Player Discovery Path

### Early Game (The Accident)

The player learns:
- Ship suffered a cascade failure
- Everyone is in stasis except them
- Life support is compromised
- They need to survive

### Mid Game (The Investigation)

Through `slvc log` and found terminals:
- Okafor was investigating something
- She disabled safety interlocks
- Something happened in the corrupted commit
- The timing is suspicious

### Late Game (The Truth)

With full engineering access:
- Okafor's research notes reveal the anomaly
- The code is visible in navigation systems
- The player must decide what to do

---

## Evidence Locations

| Evidence | Location | Access Required |
|----------|----------|-----------------|
| Emergency timeline | Any terminal | CREW |
| Door logs | Status terminals | CREW |
| Okafor's last message | Engineering terminal | ENGINEERING |
| Corrupted commit | slvc (reactor.sl) | ENGINEERING |
| Monitoring hooks | Navigation code | ENGINEERING |
| Full research notes | Okafor's quarters | OFFICER |
| Anomaly code | Navigation deep files | CAPTAIN or exploit |
