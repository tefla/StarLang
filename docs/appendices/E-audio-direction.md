# Appendix E: Audio Direction

## Philosophy

**The ship is alive.** Even alone, the Meridian breathes. Air circulates. Power hums. Systems beep and chirp. The audio creates presence without people.

**Silence is meaningful.** When something goes quiet, that's information. A fan stopping, a hum cutting out—these are signals.

**Diegetic over musical.** Sounds come from the world, not the soundtrack. The ship IS the soundtrack.

---

## Ambient Layers

### Base Layer: Ship Hum

A constant, low-frequency drone that players eventually stop noticing consciously. Combination of:

- Power conduit hum (electrical, 60Hz-ish)
- Air circulation (white noise, subtle)
- Distant machinery (rhythmic, irregular)

**Technical**: ~-20dB, heavily compressed, looped seamlessly.

### Variable Layer: Local Systems

Additional sounds based on current room:

| Location | Additional Sounds |
|----------|-------------------|
| Galley | Refrigeration hum, ventilation stronger |
| Cold Storage | Louder cooling, cold ambient |
| Corridor | Echo/reverb on footsteps |
| Engineering | Louder machinery, occasional steam |
| Near Reactor | Deep throb (when running) |

### Alert Layer: Warnings

Overrides other audio when active:

| Alert | Sound |
|-------|-------|
| O2 Low | Slow beep, every 10s |
| O2 Critical | Fast beep, every 2s |
| Power Warning | Different tone, slower |
| Fire | Klaxon (classic alarm) |
| General Emergency | Ship-wide tone |

---

## Interface Sounds

### Terminal Interactions

| Action | Sound |
|--------|-------|
| Open terminal | Soft boot-up chime |
| Close terminal | Power-down whoosh |
| Type character | Soft click (optional) |
| Command entered | Confirmation beep |
| Error | Low buzz, descending |
| Compile success | Ascending chime |
| Compile error | Harsh buzz |

### Navigation

| Action | Sound |
|--------|-------|
| Move to room | Footsteps (2-3 steps) |
| Door opening | Pneumatic hiss |
| Door closing | Softer hiss |
| Door blocked | Thunk + error |
| Access denied | Buzzer |
| Access granted | Positive chime |

### System Feedback

| Event | Sound |
|-------|-------|
| Status change | Subtle blip |
| New information | Gentle ping |
| Signal triggered | Soft whoosh |
| Revert completed | Confirmation tone |
| Save successful | Soft chime |

---

## Music

### Main Gameplay

**No score during gameplay.** The ambient sounds ARE the music. This reinforces:

- The loneliness
- The focus on problem-solving
- The diegetic world

### Menu/Title

Sparse, ambient music if anything:

- Drone-based
- No melody
- Slowly evolving
- Unnerving but not horror

### Emotional Moments (Optional)

If adding any music, only at key story beats:

| Moment | Treatment |
|--------|-----------|
| First success | Single held note, fades |
| Major discovery | Subtle drone shift |
| Final choice | Minimal, tension-building |
| Ending | Resolution chord, held |

---

## Sound Design Details

### The Lonely Ship

The goal is "I'm alone but the ship is here":

- No human sounds (no voices, no footsteps other than player's)
- Mechanical sounds suggest presence ("someone left this running")
- Occasional unexplained creaks (ship settling, not horror)

### Information Density

Sounds convey information:

- Different rooms sound different (navigate by ear)
- System states have audio signatures
- Alerts interrupt ambient (can't miss them)

### Player Actions

Player actions should feel responsive:

- Immediate feedback on all inputs
- Satisfying but not overpowering
- Consistent across contexts

---

## Technical Notes

### Format Recommendations

| Type | Format | Notes |
|------|--------|-------|
| Ambient loops | OGG/MP3 | Long, seamless |
| UI sounds | WAV | Short, low latency |
| Alerts | WAV | Need instant playback |

### Volume Balance

| Layer | Relative Volume |
|-------|-----------------|
| Base ambient | -20dB (reference) |
| Local ambient | -15dB |
| UI sounds | -10dB |
| Alerts | -5dB |
| Critical alerts | 0dB |

### Spatialization

For web/2D, minimal spatialization needed:

- Stereo panning based on room position (optional)
- No complex 3D audio
- Distance attenuation for "far" sounds

---

## Asset List (Jam Scope)

### Essential

- [ ] Base ambient loop (30s+, seamless)
- [ ] Door open/close
- [ ] Terminal open/close
- [ ] Error buzz
- [ ] Success chime
- [ ] Alert beep (O2)
- [ ] Footsteps (2-3 variations)

### Nice to Have

- [ ] Multiple room ambiences
- [ ] Typing sounds
- [ ] More alert variations
- [ ] Compile success/fail
- [ ] Different door types

### Can Use Placeholder/Skip

- [ ] Detailed room ambiences (use base + filter)
- [ ] Music
- [ ] Voice (none needed)
- [ ] Complex spatialization

---

## Accessibility Considerations

- All critical information also shown visually
- Alert sounds distinct from ambient (not just volume)
- Option to increase alert volume
- Captions for any spoken content (if added)
- Consider audio-only versions of key alerts for screenreaders

---

## Sound Sources

For jam scope, consider:

- **Freesound.org**: CC-licensed effects
- **Generated**: Tools like sfxr for UI sounds
- **Recorded**: Household items for foley
- **Synthesized**: DAW for ambient drones

**Avoid** copyrighted sound effects or music.
