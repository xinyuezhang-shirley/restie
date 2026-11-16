/** 24px line icons with a 2px rounded stroke — the med-fi icon set. */
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export type IconName =
  | 'back'
  | 'send'
  | 'close'
  | 'plus'
  | 'pencil'
  | 'check'
  | 'camera'
  | 'gallery'
  | 'flip'
  | 'pause'
  | 'play'
  | 'drag'
  | 'right'
  | 'down'
  | 'up'
  | 'home'
  | 'hobbies'
  | 'todos'
  | 'keepsakes'
  | 'info'
  | 'paw'
  | 'chat'
  | 'clock'
  | 'settings'
  | 'trash'
  | 'pin'
  | 'note'
  | 'sparkle'
  | 'more'
  | 'calendar';

export function Icon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shapes: Record<IconName, React.ReactNode> = {
    back: <Path d="m15 18-6-6 6-6" {...p} />,
    send: <Path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h13" {...p} />,
    close: <Path d="m6 6 12 12M18 6 6 18" {...p} />,
    plus: <Path d="M12 5v14M5 12h14" {...p} />,
    calendar: <Path d="M5 6h14v14H5V6Zm0 4h14M9 4v4m6-4v4" {...p} />,
    pencil: <Path d="m4 20 4-1 11-11-3-3L5 16l-1 4Zm10-13 3 3" {...p} />,
    check: <Path d="m5 12 4 4L19 6" {...p} />,
    camera: (
      <>
        <Path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" {...p} />
        <Circle cx={12} cy={13} r={3} {...p} />
      </>
    ),
    gallery: (
      <>
        <Rect x={4} y={5} width={16} height={14} rx={2} {...p} />
        <Path d="m5 17 5-5 3 3 2-2 4 4M15 9h.01" {...p} />
      </>
    ),
    flip: <Path d="M7 7h11l-3-3M17 17H6l3 3M20 7v4M4 17v-4" {...p} />,
    pause: <Path d="M9 7v10M15 7v10" {...p} />,
    play: <Path d="M8 6v12l10-6-10-6Z" {...p} />,
    drag: <Path d="M6 9h12M6 15h12" {...p} />,
    right: <Path d="m9 6 6 6-6 6" {...p} />,
    down: <Path d="m6 9 6 6 6-6" {...p} />,
    up: <Path d="m6 15 6-6 6 6" {...p} />,
    home: <Path d="M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4v-8.5Z" {...p} />,
    // a paintbrush (heuristic eval #30: the old shape didn't read as "hobbies")
    hobbies: (
      <>
        <Path d="M20.5 3.5 13.2 10.8" {...p} />
        <Path d="m11.3 9 3.7 3.7" {...p} />
        <Path d="M11.3 9C8 8.6 5.6 11 5.6 14c0 2.1-.9 3.6-2.6 4.8 3.7 1.4 7.6.7 9.7-1.4 1.6-1.6 2.4-3.1 2.3-4.7" {...p} />
      </>
    ),
    todos: (
      <>
        <Rect x={5} y={4} width={14} height={17} rx={2} {...p} />
        <Path d="m8 10 2 2 4-4M9 16h6" {...p} />
      </>
    ),
    // an instant photo (heuristic eval #32: keepsakes are photos & notes, not a chart)
    keepsakes: (
      <>
        <Rect x={5} y={3} width={14} height={18} rx={1.8} {...p} />
        <Rect x={7.5} y={5.5} width={9} height={9} rx={0.8} {...p} />
        <Path d="m7.5 12.5 2.5-2.5 2 2 1.5-1.5 3 3" {...p} />
      </>
    ),
    info: (
      <>
        <Circle cx={12} cy={12} r={9} {...p} />
        <Path d="M12 11v6M12 7h.01" {...p} />
      </>
    ),
    paw: (
      <>
        <Ellipse cx={12} cy={16} rx={5} ry={4.2} fill={color} />
        <Circle cx={6} cy={10.5} r={2.2} fill={color} />
        <Circle cx={18} cy={10.5} r={2.2} fill={color} />
        <Circle cx={9.3} cy={6.5} r={2.2} fill={color} />
        <Circle cx={14.7} cy={6.5} r={2.2} fill={color} />
      </>
    ),
    chat: <Path d="M5 6h14v10H10l-4 3v-3H5V6Z" {...p} />,
    clock: (
      <>
        <Circle cx={12} cy={12} r={8} {...p} />
        <Path d="M12 8v4l3 2" {...p} />
      </>
    ),
    settings: (
      <>
        <Circle cx={12} cy={12} r={3} {...p} />
        <Path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" {...p} />
      </>
    ),
    trash: <Path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" {...p} />,
    pin: <Path d="M9 4h6l-1 6 3 3H7l3-3-1-6ZM12 13v7" {...p} />,
    note: <Path d="M6 4h9l3 3v13H6V4Zm3 7h6M9 15h4" {...p} />,
    sparkle: <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" {...p} />,
    more: (
      <>
        <Circle cx={6} cy={12} r={1.2} fill={color} />
        <Circle cx={12} cy={12} r={1.2} fill={color} />
        <Circle cx={18} cy={12} r={1.2} fill={color} />
      </>
    ),
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {shapes[name]}
    </Svg>
  );
}
