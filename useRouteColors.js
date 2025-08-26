// useRouteColors.js
import { useContext, useMemo } from 'react';
import { UserContext } from './UserContext';

export function useRouteColors() {
  const { user } = useContext(UserContext) || {};
  const prefs = (user && user.preferences) || {};

  const liveColor           = prefs.liveRouteColor     || '#1E90FF'; // run/live default
  const officialColor       = prefs.officialRouteColor || '#000000'; // trail/official
  const warn1Color          = prefs.warningColor1      || '#FFA500'; // warn
  const warn2Color          = prefs.warningColor2      || '#FF0000'; // critical
  const warningThreshold1Ft = Number(prefs.warningThreshold1 ?? 50);
  const warningThreshold2Ft = Number(prefs.warningThreshold2 ?? 75);

  // Granular signatures for snapshot cache keys:
  const signatureOfficial  = `${officialColor}`; // TrailList thumbnails
  const signatureRunThumb  = `${liveColor}|${warn1Color}|${warn2Color}|${warningThreshold1Ft}|${warningThreshold2Ft}`; // RunList thumbnails

  // Full signature if you ever need “everything”
  const signatureAll = `${signatureOfficial}|${signatureRunThumb}`;

  return useMemo(
    () => ({
      // colors
      liveColor,
      officialColor,
      warn1Color,
      warn2Color,
      // thresholds (feet)
      warningThreshold1: warningThreshold1Ft,
      warningThreshold2: warningThreshold2Ft,
      // signatures
      signatureOfficial,
      signatureRunThumb,
      signatureAll,
    }),
    [
      liveColor,
      officialColor,
      warn1Color,
      warn2Color,
      warningThreshold1Ft,
      warningThreshold2Ft,
      signatureOfficial,
      signatureRunThumb,
      signatureAll,
    ]
  );
}
