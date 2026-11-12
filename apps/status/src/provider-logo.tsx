import { useState } from "react";
import { Network } from "lucide-react";
import type { ProviderId } from "@repo/data/providers";
import { sharedAssetUrl, type SharedAssetPath } from "./site-links";

const providerArtwork = {
  digitraffic: "/providers/digitraffic.svg",
  entur: "/providers/entur.svg",
  irail: "/providers/irail.svg",
  irishrail: "/operators/ie/ir.svg",
  ns: "/operators/nl/ns.svg",
  "opendata-ch": "/providers/opendata-ch.png",
  rfi: "/providers/rfi.svg",
  nationalrail: "/providers/nationalrail.svg",
  sncf: "/operators/fr/sncf.svg",
  db: "/operators/de/db.svg",
  rejseplanen: "/providers/rejseplanen.png",
  plk: "/providers/plk.svg",
  trafiklab: "/providers/trafiklab.png",
  mobiliteit: "/providers/mobiliteit.svg",
  mav: "/operators/hu/mav.svg",
} satisfies Record<ProviderId, SharedAssetPath>;

export function ProviderLogo({ id }: { id: ProviderId }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="provider-logo" aria-hidden="true">
      {failed ? (
        <Network />
      ) : (
        <img
          src={sharedAssetUrl(providerArtwork[id])}
          alt=""
          width="36"
          height="36"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
