import { Card, ColorSwatch, Reveal, Row, Segmented, Select, SliderRow, Toggle } from '../components/controls.jsx';
import { COMPACT_MODE_OPTIONS, VIZ_COLOR_OPTIONS } from '../state/presets.js';

export default function Music({ store }) {
    const { settings, update } = store;

    return (
        <>
            <Card>
                <Toggle
                    label="Lecteur de musique"
                    description="Spotify, Deezer, YouTube, navigateurs et autres lecteurs Windows."
                    checked={settings.musicEnabled}
                    onChange={(musicEnabled) => update({ musicEnabled })}
                />
            </Card>

            <Reveal when={settings.musicEnabled}>
                <Card title="Lecteur">
                    <Row label="Pilule réduite" description="Ce qui s’affiche quand l’Island est repliée.">
                        <Select
                            value={settings.idleCompactMode}
                            options={COMPACT_MODE_OPTIONS}
                            onChange={(idleCompactMode) => update({ idleCompactMode })}
                        />
                    </Row>
                    <Toggle label="Afficher la durée" checked={settings.showTimes} onChange={(showTimes) => update({ showTimes })} />
                    <Toggle
                        label="Boutons rapides"
                        description="Historique, favoris et widgets en haut du lecteur."
                        checked={settings.showActions}
                        onChange={(showActions) => update({ showActions })}
                    />
                    <Toggle
                        label="La molette règle l’application"
                        description="Change le volume du lecteur plutôt que celui de Windows."
                        checked={settings.wheelAppVolume}
                        onChange={(wheelAppVolume) => update({ wheelAppVolume })}
                    />
                </Card>

                <Card title="Visualiseur">
                    <Toggle
                        label="Barres audio sous le lecteur"
                        checked={settings.showVisualizer}
                        onChange={(showVisualizer) => update({ showVisualizer })}
                    />
                    <Segmented
                        label="Couleurs"
                        value={settings.vizColorMode}
                        options={VIZ_COLOR_OPTIONS}
                        onChange={(vizColorMode) => update({ vizColorMode })}
                    />
                    {settings.vizColorMode === 'solid' && (
                        <Row label="Couleur">
                            <ColorSwatch label="Couleur" value={settings.vizColorSolid} onChange={(vizColorSolid) => update({ vizColorSolid })} />
                        </Row>
                    )}
                    {settings.vizColorMode === 'gradient' && (
                        <Row label="Dégradé" description="Du grave vers l’aigu.">
                            <div className="swatch-pair">
                                <ColorSwatch label="Début" value={settings.vizColorGradA} onChange={(vizColorGradA) => update({ vizColorGradA })} />
                                <span className="swatch-arrow" />
                                <ColorSwatch label="Fin" value={settings.vizColorGradB} onChange={(vizColorGradB) => update({ vizColorGradB })} />
                            </div>
                        </Row>
                    )}
                    <SliderRow
                        label="Sensibilité"
                        value={settings.visualizerSensitivity}
                        min={1}
                        max={25}
                        step={0.5}
                        format={(v) => `${Number(v).toFixed(1)}×`}
                        onChange={(visualizerSensitivity) => update({ visualizerSensitivity: Math.round(visualizerSensitivity * 2) / 2 })}
                    />
                </Card>
            </Reveal>
        </>
    );
}
