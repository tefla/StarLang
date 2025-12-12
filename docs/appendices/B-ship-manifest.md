# Appendix B: Ship Manifest

## UTS Meridian

**Class:** Horizon-IV Colony Transport  
**Registry:** UTS-7834-M  
**Launched:** 2285  
**Current Mission:** Tau Ceti colonization run  

---

## Specifications

| Attribute | Value |
|-----------|-------|
| Length | 342 meters |
| Beam | 78 meters |
| Mass (loaded) | 45,000 tonnes |
| Crew capacity | 62 |
| Passenger capacity | 847 |
| Cargo capacity | 12,000 tonnes |
| Propulsion | Fusion torch + ion assist |
| Max acceleration | 0.3g sustained |
| Life support | Closed-loop with reserves |
| Journey time | ~14 years (Tau Ceti) |

---

## Deck Layout

### Deck 1: Bridge & Command

The topmost deck, housing bridge operations and senior officer quarters.

| Area | Purpose | Access |
|------|---------|--------|
| Bridge | Ship navigation and command | OFFICER+ |
| Captain's Ready Room | Captain's office | CAPTAIN |
| Captain's Quarters | Captain's living space | CAPTAIN |
| First Officer's Quarters | XO living space | OFFICER |
| Conference Room | Briefings and meetings | OFFICER+ |
| Communications Array | External communications | OFFICER+ |

### Deck 2: Engineering & Life Support

Core ship systems and engineering operations.

| Area | Purpose | Access |
|------|---------|--------|
| Engineering Main | Primary systems control | ENGINEERING |
| Reactor Control | Fusion reactor monitoring | ENGINEERING |
| Life Support Primary | Main atmosphere systems | ENGINEERING |
| Life Support Backup | Redundant systems | ENGINEERING |
| Power Distribution | Ship-wide power routing | ENGINEERING |
| Engineering Quarters | Engineering crew bunks | ENGINEERING |

### Deck 3: Passenger & Medical

Passenger areas and medical facilities.

| Area | Purpose | Access |
|------|---------|--------|
| Stasis Bay Alpha | Passenger stasis pods (400) | MEDICAL |
| Stasis Bay Beta | Passenger stasis pods (447) | MEDICAL |
| Medical Bay | Primary medical facility | MEDICAL |
| Medical Storage | Supplies and equipment | MEDICAL |
| Passenger Commons | Waking-period gathering | CREW |
| Recreation | Entertainment facilities | CREW |

### Deck 4: Crew Services (Game Area)

Primary gameplay area—crew quarters and services.

| Area | Purpose | Access | Notes |
|------|---------|--------|-------|
| **Galley** | Food preparation | COOK | **Starting location** |
| **Cold Storage** | Frozen food storage | COOK | Adjacent to galley |
| **Crew Mess** | Crew dining area | CREW | Stuck door puzzle |
| **Crew Quarters** | Individual crew cabins | CREW | Personal items |
| **Corridor 4-Alpha** | Main corridor | CREW | Sealed at start |
| **Maintenance Junction 4A** | Utility access | ENGINEERING | Engineering terminal |
| **Medical Auxiliary** | Basic first aid | CREW | Medical supplies |

### Deck 5: Cargo & Storage

Cargo holds and long-term storage.

| Area | Purpose | Access |
|------|---------|--------|
| Cargo Hold A | Colony equipment | OPERATIONS |
| Cargo Hold B | Personal effects | OPERATIONS |
| Equipment Lockers | EVA suits, tools | OPERATIONS |
| Hazmat Storage | Dangerous materials | ENGINEERING |

---

## Crew Manifest (Relevant)

### Command Staff

| Name | Role | Notes |
|------|------|-------|
| Capt. Maria Torres | Captain | By-the-book, competent |
| Cmdr. James Webb | First Officer | Currently in stasis |
| Lt. Sarah Kim | Helm | Currently in stasis |

### Engineering

| Name | Role | Notes |
|------|------|-------|
| **Chief Amara Okafor** | Chief Engineer | Found the anomaly |
| Marcus Chen | Engineer First Class | Left tablet in galley |
| Jessica Torres | Engineer Second Class | Operations' Torres's sister |
| David Park | Junior Engineer | Currently in stasis |

### Medical

| Name | Role | Notes |
|------|------|-------|
| Dr. Hassan Yusuf | Chief Medical Officer | Terminal in medbay |
| Dr. Lisa Wong | Medical Assistant | Currently in stasis |

### Operations

| Name | Role | Notes |
|------|------|-------|
| **Riley Chen** | Cook | **Player character** |
| Wei Chen | Cook (no relation) | Left message on terminal |
| Tom Bradley | Maintenance | Currently in stasis |
| Ana Reyes | Steward | Currently in stasis |

### Security

| Name | Role | Notes |
|------|------|-------|
| Lt. Michael Santos | Security Chief | Key cards somewhere |
| Officer Emma Wright | Security | Currently in stasis |

---

## Current Ship Status

At game start (2287.203.16:42):

| System | Status | Notes |
|--------|--------|-------|
| Propulsion | OK | On course to Tau Ceti |
| Navigation | OK (suspect) | Anomaly location |
| Reactor | SCRAM | Emergency shutdown |
| Life Support | DEGRADED | Running on backup |
| Atmosphere | CRITICAL (Galley) | Outlet misconfigured |
| Power | BACKUP | 72 hours reserve |
| Communications | OFFLINE | Antenna damaged |
| Stasis | LOCKED | All pods inaccessible |

---

## Key Locations (Gameplay)

### Starting Area

```
                    ┌─────────────────┐
                    │   Medical Bay   │
                    │   (auxiliary)   │
                    └────────┬────────┘
                             │ (frozen)
┌──────────┐    ┌────────────┴───────────┐
│   Cold   │────│                        │
│ Storage  │    │    GALLEY (START)      │
└──────────┘    │                        │
                └───────────┬────────────┘
                     (stuck)│
                ┌───────────┴───────────┐
                │                       │
                │     Crew Mess         │
                │                       │
                └───────────┬───────────┘
                            │
            ┌───────────────┴───────────────┐
            │       Corridor 4-Alpha        │──── (sealed - O2 crisis)
            │                               │
            └───┬───────────────────────┬───┘
                │                       │
        ┌───────┴──────┐        ┌───────┴──────┐
        │    Crew      │        │ Maintenance  │
        │  Quarters    │        │ Junction 4A  │
        └──────────────┘        └──────────────┘
```

### Important Items

| Item | Location | Purpose |
|------|----------|---------|
| Engineering tablet | Behind panel, Maintenance Junction | ENGINEERING credentials |
| First aid kit | Medical Bay Auxiliary | Healing? Atmosphere mask? |
| Personal effects | Crew Quarters | Story clues |
| Access codes | Documentation / hidden | Various doors |
| Okafor's notes | Engineering (late game) | Story revelation |
