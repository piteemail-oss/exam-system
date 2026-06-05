let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

export function playCorrectSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 清脆的 "叮咚" — 两个短促的三角波
    const notes = [880, 1100] // A5 → C#6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.08)
      gain.gain.linearRampToValueAtTime(0.04, now + i * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.08)
      osc.stop(now + i * 0.08 + 0.2)
    })
  } catch {}
}

export function playWrongSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime

    // 柔和的 "嘟" — 低频短音
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 260 // C4
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.3, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.35)
  } catch {}
}

export function getSoundEnabled() {
  try {
    const val = localStorage.getItem('sound_enabled')
    return val !== '0'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled) {
  localStorage.setItem('sound_enabled', enabled ? '1' : '0')
}
