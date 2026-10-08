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

            <Card footer={editMode ? 'Fais glisser l’Island. La barre sous elle (ou la molette) règle la taille ; Terminer ou Échap pour valider.' : undefined}>
                <Row label="Déplacer l’Island" description="Aussi accessible par clic droit sur l’Island.">
                    <Button icon={editMode ? 'ph-check' : 'ph-hand-grabbing'} tone={editMode ? 'accent' : undefined} onClick={toggleEditMode}>
                        {editMode ? 'Terminer' : 'Déplacer'}
                    </Button>
                </Row>
                <Row label="Recentrer" description="En haut, au centre de l’écran, sans changer la taille.">
                    <Button icon="ph-arrows-in-cardinal" onClick={recenter}>Recentrer</Button>
                </Row>
            </Card>
        </>
    );
}
