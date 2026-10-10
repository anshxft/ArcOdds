// "Meet Poring" on the Docs page: every animation in poring.avatar.json, one tap each.
import { useRef, useState } from 'react'
import { createAvatar, type AvatarController } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import definition from './poring.avatar.json'
import type { Mood } from './react'
import { Asterisk, Label } from '@/components/site'

const Poring = createAvatar(definition)

const GROUPS: [string, Mood[]][] = [
  ['Everyday', ['idle', 'listening', 'thinking', 'searching', 'working', 'curious', 'bored', 'drowsy', 'yawn', 'sleeping', 'waking']],
  ['Happy', ['happy', 'excited', 'laughing', 'playful', 'proud', 'celebrate', 'party', 'golden', 'love', 'blush', 'kawaii', 'star-struck', 'amazed', 'welcome', 'wink', 'dance']],
  ['Not so happy', ['sad', 'crying', 'angry', 'furious', 'grumpy', 'scared', 'nervous', 'shocked', 'surprised', 'confused', 'suspicious', 'shy', 'sick', 'freezing', 'dizzy', 'oof']],
  ['Attitude', ['cool', 'smug', 'side-eye', 'eye-roll', 'silly', 'pleading', 'greedy', 'ghost', 'dreamy', 'peek']],
  ['Moving & guiding', ['walk-left', 'walk-right', 'watch-left', 'watch-right', 'watch-up', 'watch-down', 'hop', 'nod', 'explain', 'point-left', 'point-right']],
]
// Anything added to the JSON later still gets a button.
const listed = new Set(GROUPS.flatMap(([, moods]) => moods))
const rest = (definition.animationOrder as Mood[]).filter((mood) => !listed.has(mood))
if (rest.length) GROUPS.push(['More', rest])

export default function Gallery() {
  const avatar = useRef<AvatarController>(null)
  const [active, setActive] = useState<Mood>('idle')

  return (
    <section className="frame grid border-t-0 md:grid-cols-12" data-tour="poring" aria-labelledby="meet-poring">
      <div className="cell flex flex-col items-center justify-center gap-4 p-8 md:col-span-4 md:sticky md:top-14 md:self-start">
        <div className="w-36 md:w-44">
          <Poring ref={avatar} defaultAnimation="idle" size="100%" ariaLabel={`Poring, playing ${active}`} />
        </div>
        <Label className="text-ink">Now playing: {active}</Label>
      </div>
      <div className="cell p-6 md:col-span-8 md:p-8">
        <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label>Mascot</Label></span>
        <h2 id="meet-poring" className="font-display mt-3 text-3xl font-bold">Meet Poring</h2>
        <p className="mt-2 max-w-xl text-muted">
          The orange blob roaming the site. Tap it for help or a tour, drag it and let go to throw it. Here is every mood it has, {definition.animationOrder.length} in all.
        </p>
        <div className="mt-6 space-y-5">
          {GROUPS.map(([group, moods]) => (
            <div key={group}>
              <Label>{group}</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {moods.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    aria-pressed={active === mood}
                    onClick={() => {
                      avatar.current?.play(mood)
                      setActive(mood)
                    }}
                    className={`press label border px-2.5 py-1.5 ${active === mood ? 'border-ink bg-ink text-paper' : 'border-line-strong hover-ink'}`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
