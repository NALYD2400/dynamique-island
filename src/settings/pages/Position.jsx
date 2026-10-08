import { Button, Card, Row, Select, SliderRow } from '../components/controls.jsx';
import { useLayout } from '../state/useSettings.js';

export default function Position() {
    const { layout, editMode, displays, setScale, setDisplay, toggleEditMode, recenter } = useLayout();
    const displayOptions = displays.map((display) => ({ value: display.id, label: display.label }));

    return (
        <>
            <Card>
                {displayOptions.length > 1 && (
                    <Row label="Écran">
                        <Select value={layout.displayId} options={displayOptions} onChange={setDisplay} />
                    </Row>
                )}
                <SliderRow
                    label="Taille"
                    value={Math.round((layout.scale || 1) * 100)}
                    min={65}
                    max={150}
                    format={(v) => `${Math.round(v)} %`}
                    onChange={(value) => setScale(Math.round(value) / 100)}
                />
            </Card>

            <Card footer={editMode ? 'Fais glisser l’Island à l’endroit voulu, puis clique sur Terminer.' : undefined}>
                <Row label="Déplacer l’Island" description="Active le placement libre à la souris.">
                    <Button icon={editMode ? 'ph-check' : 'ph-hand-grabbing'} tone={editMode ? 'accent' : undefined} onClick={toggleEditMode}>
                        {editMode ? 'Terminer' : 'Déplacer'}
                    </Button>
                </Row>
                <Row label="Position d’origine" description="En haut, au centre de l’écran.">
                    <Button icon="ph-arrows-in-cardinal" onClick={recenter}>Recentrer</Button>
                </Row>
            </Card>
        </>
    );
}
