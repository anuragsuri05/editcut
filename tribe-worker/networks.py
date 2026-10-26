"""Group TRIBE v2 cortical predictions (fsaverage5, 20,484 vertices) into functional networks.

TRIBE v2 predicts one value per cortical vertex per second. We summarize the
vertices with the Destrieux surface atlas (shipped with nilearn on fsaverage5,
10,242 vertices per hemisphere, left first, same order as TRIBE's output) and
assign Destrieux parcels to eight broad networks that matter for watching video.

The parcel-to-network assignment is an anatomical approximation (Destrieux is a
gyral/sulcal atlas, not a functional one), so treat network names as coarse
labels, not precise functional localizers.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np

N_PER_HEMI = 10242
N_VERTICES = 2 * N_PER_HEMI

# Destrieux label substrings -> network. First match wins, so order matters.
NETWORK_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("motion", ("S_occipital_ant", "G_temporal_middle", "S_oc_middle_and_Lunatus", "G_occipital_middle")),
    ("faces", ("G_oc-temp_lat-fusifor", "S_oc-temp_lat", "S_collat_transv_post", "G_temporal_inf")),
    ("visual", ("G_cuneus", "S_calcarine", "Pole_occipital", "G_occipital_sup", "S_oc_sup_and_transversal", "G_oc-temp_med-Lingual", "S_oc-temp_med_and_Lingual", "S_parieto_occipital", "G_and_S_occipital_inf", "S_occipital_inf" )),
    ("auditory", ("G_temp_sup-G_T_transv", "S_temporal_transverse", "G_temp_sup-Plan_tempo", "Lat_Fis-post")),
    ("language", ("G_temp_sup-Lateral", "S_temporal_sup", "G_front_inf-Opercular", "G_front_inf-Triangul", "G_front_inf-Orbital", "Pole_temporal", "S_temporal_inf")),
    ("attention", ("S_intrapariet_and_P_trans", "G_parietal_sup", "S_precentral-sup-part", "G_pariet_inf-Supramar", "S_postcentral")),
    ("salience", ("G_insular_short", "G_Ins_lg_and_S_cent_ins", "S_circular_insula", "G_and_S_cingul-Ant", "G_and_S_cingul-Mid-Ant", "G_and_S_frontomargin")),
    ("social", ("G_pariet_inf-Angular", "G_precuneus", "G_cingul-Post", "G_rectus", "G_subcallosal", "G_front_sup", "S_suborbital", "G_orbital", "G_and_S_cingul-Mid-Post")),
]

NETWORK_IDS = [name for name, _ in NETWORK_PATTERNS]


def _decode(label: object) -> str:
    return label.decode() if isinstance(label, bytes) else str(label)


@lru_cache(maxsize=1)
def network_masks() -> dict[str, np.ndarray]:
    """Boolean mask (N_VERTICES,) per network, built from nilearn's Destrieux atlas."""
    from nilearn import datasets

    atlas = datasets.fetch_atlas_surf_destrieux()
    labels = [_decode(lbl) for lbl in atlas["labels"]]
    per_vertex = np.concatenate([np.asarray(atlas["map_left"]), np.asarray(atlas["map_right"])])
    if per_vertex.shape[0] != N_VERTICES:
        raise RuntimeError(f"Destrieux atlas has {per_vertex.shape[0]} vertices, expected {N_VERTICES} (fsaverage5)")

    label_network: dict[int, str] = {}
    for idx, name in enumerate(labels):
        for network, patterns in NETWORK_PATTERNS:
            if any(p in name for p in patterns):
                label_network[idx] = network
                break

    masks = {}
    for network in NETWORK_IDS:
        ids = [i for i, n in label_network.items() if n == network]
        masks[network] = np.isin(per_vertex, ids)
    return masks


def summarize(preds: np.ndarray) -> dict[str, object]:
    """Reduce (T, 20484) predictions to per-second network signals.

    Each network signal is the mean activation over its vertices, then z-scored
    across the video's seconds so networks are comparable. `global` is the mean
    absolute z-scored activation of the whole cortex.
    """
    if preds.ndim != 2 or preds.shape[1] != N_VERTICES:
        raise ValueError(f"expected predictions of shape (T, {N_VERTICES}), got {preds.shape}")

    def z(x: np.ndarray) -> np.ndarray:
        sd = x.std()
        return (x - x.mean()) / sd if sd > 1e-8 else np.zeros_like(x)

    masks = network_masks()
    networks = {name: z(preds[:, mask].mean(axis=1)).round(4).tolist() for name, mask in masks.items()}
    vz = (preds - preds.mean(axis=0)) / (preds.std(axis=0) + 1e-8)
    global_signal = z(np.abs(vz).mean(axis=1)).round(4).tolist()
    return {"networks": networks, "global": global_signal, "vertexCounts": {k: int(v.sum()) for k, v in masks.items()}}
