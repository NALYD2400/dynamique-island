import { Card, ChoiceGrid, Reveal, Segmented, SliderRow, Toggle } from '../components/controls.jsx';
import { WALLPAPER_BLUR_OPTIONS, WALLPAPER_STYLE_OPTIONS } from '../state/presets.js';

export default function Wallpaper({ store }) {
    const { settings, update } = store;
    const blurry = settings.wallpaperSyncStyle !== 'sharp';

    return (
        <>
            <Card footer="Ton fond d’écran d’origine est rétabli dès que tu désactives l’option ou que tu quittes l’application.">
                <Toggle
                    label="Pochette en fond d’écran"
                    description="Le bureau Windows suit le morceau en cours."
                    checked={settings.wallpaperSync}
                    onChange={(wallpaperSync) => update({ wallpaperSync })}
                />
            </Card>

            <Reveal when={settings.wallpaperSync}>
                <Card title="Style">
                    <ChoiceGrid
                        value={settings.wallpaperSyncStyle}
                        options={WALLPAPER_STYLE_OPTIONS}
                        onChange={(wallpaperSyncStyle) => update({ wallpaperSyncStyle })}
                    />
                    {blurry && (
                        <>
                            <Segmented
                                label="Flou"
                                value={settings.wallpaperBlurIntensity}
                                options={WALLPAPER_BLUR_OPTIONS}
                                onChange={(wallpaperBlurIntensity) => update({ wallpaperBlurIntensity })}
                            />
                            <SliderRow
                                label="Assombrissement"
                                value={settings.wallpaperDarken}
                                min={0}
                                max={50}
                                format={(v) => `${Math.round(v)} %`}
                                onChange={(wallpaperDarken) => update({ wallpaperDarken: Math.round(wallpaperDarken) })}
                            />
                        </>
                    )}
                </Card>
            </Reveal>
        </>
    );
}
