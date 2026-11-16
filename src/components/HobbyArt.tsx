/**
 * A hobby's picture, and Rusty's drawings for hobbies and keepsakes.
 *
 *   HobbyArt     the drawing you kept for it, else the built-in sticker
 *   RustyDraws   on a hobby / keepsake page: Rusty's new drawing waiting for
 *                you (Keep it / Try again / No thanks), "Rusty is drawing…",
 *                or "Ask Rusty to draw one". Hidden when drawing isn't set up.
 */
import { Image } from 'expo-image';
import { View } from 'react-native';

import { dropOffer, keepOffer, startDrawing, useArtJobs, useArtStatus, useArtUrl } from '@/ai/art';
import { hobbyIcons } from '@/assets';
import { showToast, useStore } from '@/data/store';
import type { ArtOffer, Hobby } from '@/data/types';
import { colors, radius, space } from '@/theme/tokens';

import { Button, Card, Row, RustyAvatar, T } from './ui';

export function HobbyArt({ hobby, size }: { hobby: Hobby; size: number }) {
  const url = useArtUrl(hobby.artPath);
  return (
    <Image
      // cacheKey: the signed URL changes, the drawing doesn't
      source={url ? { uri: url, cacheKey: hobby.artPath ?? undefined } : hobbyIcons[hobby.icon]}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={200}
      accessible={false}
    />
  );
}

export function useOfferFor(targetId: string): ArtOffer | undefined {
  return useStore((s) => s.profile.mind.artOffers?.find((o) => o.targetId === targetId));
}

export function RustyDraws({
  kind,
  targetId,
  subject,
  detail,
  hasArt,
  /** offer the "draw one" button (e.g. only for hobbies with no built-in picture) */
  canAsk,
}: {
  kind: ArtOffer['kind'];
  targetId: string;
  subject: string;
  detail?: string;
  hasArt: boolean;
  canAsk: boolean;
}) {
  const status = useArtStatus();
  const offer = useOfferFor(targetId);
  const job = useArtJobs((s) => s.jobs[targetId]);
  const url = useArtUrl(offer?.path);
  if (!status?.configured && !offer) return null;

  const again = () => void startDrawing(kind, targetId, subject, detail);
  const left = status ? `${status.left} of ${status.cap} drawings left this month` : '';

  if (offer) {
    return (
      <Card style={{ gap: space.sm }}>
        <Row gap={space.sm}>
          <RustyAvatar pose="painting" size={44} />
          <T v="headline" style={{ flex: 1 }}>
            {kind === 'hobby' ? `I drew something for your ${subject.toLowerCase()} corner. Want it?` : 'I drew this for your keepsake. Want it?'}
          </T>
        </Row>
        <View style={{ alignItems: 'center', backgroundColor: colors.muted, borderRadius: radius.card, paddingVertical: space.sm }}>
          <Image source={url ? { uri: url } : undefined} style={{ width: 180, height: 180 }} contentFit="contain" accessibilityLabel={`Rusty's drawing: ${offer.object}`} />
        </View>
        <T v="caption">{`${offer.object} · it passed Rusty’s checks: looks like ${subject.toLowerCase()}, safe, and matches his room’s style.`}</T>
        <Button
          small
          onPress={() => {
            keepOffer(offer);
            showToast(kind === 'hobby' ? `Rusty hung it up in the room. 🎨` : 'Added to your keepsake.');
          }}
        >
          Keep it
        </Button>
        <Row>
          <Button small full={false} variant="secondary" style={{ flex: 1 }} disabled={!status || status.left <= 0 || job?.state === 'drawing'} onPress={again}>
            {job?.state === 'drawing' ? 'Drawing…' : 'Try again'}
          </Button>
          <Button small full={false} variant="tertiary" style={{ flex: 1 }} onPress={() => dropOffer(offer.id)}>
            {kind === 'hobby' ? 'Keep the basket' : 'No thanks'}
          </Button>
        </Row>
        {!!left && <T v="caption">{left}</T>}
      </Card>
    );
  }

  if (job?.state === 'drawing') {
    return (
      <Card style={{ gap: space.xs }}>
        <Row gap={space.sm}>
          <RustyAvatar pose="painting" size={44} />
          <View style={{ flex: 1 }}>
            <T v="headline">Rusty is drawing…</T>
            <T v="caption">About a minute. He checks it before he shows you.</T>
          </View>
        </Row>
      </Card>
    );
  }

  if (!canAsk && !job) return null;
  return (
    <Card style={{ gap: space.xs }}>
      {job?.state === 'failed' ? (
        <T v="caption">{`Rusty tried, but it didn’t pass his checks${job.reasons[0] ? ` (${job.reasons[0]})` : ''}. Want him to try again?`}</T>
      ) : job?.state === 'cap' ? (
        <T v="caption">Rusty’s out of paint this month. He’ll draw it soon. For now: the basket.</T>
      ) : job?.state === 'error' ? (
        <T v="caption">Rusty couldn’t draw just now. Try again in a bit.</T>
      ) : (
        <T v="caption">{kind === 'hobby' ? `I don’t have a picture for ${subject.toLowerCase()} yet.` : 'No photo here. Rusty could illustrate it.'}</T>
      )}
      {job?.state !== 'cap' && (
        <Button small variant="secondary" icon="sparkle" disabled={!status || status.left <= 0} onPress={again}>
          {hasArt ? 'Ask Rusty for a new drawing' : kind === 'hobby' ? 'Ask Rusty to draw one' : 'Ask Rusty to illustrate this'}
        </Button>
      )}
      {!!left && <T v="caption">{left}</T>}
    </Card>
  );
}
