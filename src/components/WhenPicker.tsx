/**
 * "When can you do it?" in chat-style flows (new hobby, check-ins, Rusty's
 * chat): Today / Tomorrow / This weekend are one tap; "Pick a day & time"
 * opens a calendar and a time wheel for anything else.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { resolveWhen, startOfDay, type WhenChoice } from '@/lib/time';
import { space } from '@/theme/tokens';

import { Button, Chip, ChipRow } from './ui';
import { dueAtOf, WhenField, whenSummary, type When } from './WhenField';

export interface WhenValue {
  date: Date;
  timed: boolean;
  label: string;
}

const QUICK: { key: WhenChoice; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];

export function WhenPicker({ onPick, hintKey }: { onPick: (v: WhenValue) => void; hintKey?: WhenChoice }) {
  const [custom, setCustom] = useState(false);
  const [when, setWhen] = useState<When>({ day: startOfDay(), time: null, minutes: null });

  return (
    <View style={{ gap: space.md }}>
      <ChipRow>
        {QUICK.map((q) => (
          <Chip key={q.key} hint={hintKey === q.key} onPress={() => onPick({ date: resolveWhen(q.key), timed: false, label: q.label })}>
            {q.label}
          </Chip>
        ))}
        <Chip custom icon="calendar" selected={custom} onPress={() => setCustom((c) => !c)}>
          Pick a day & time
        </Chip>
      </ChipRow>
      {custom && (
        <View style={{ gap: space.md }}>
          <WhenField value={when} onChange={setWhen} />
          <Button
            small
            onPress={() => {
              const d = dueAtOf(when);
              if (d) onPick({ date: d, timed: !!when.time, label: whenSummary(when) });
            }}
          >
            {`Choose ${whenSummary(when)}`}
          </Button>
        </View>
      )}
    </View>
  );
}
