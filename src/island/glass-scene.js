/**
 * Chargé à la demande par features/glass.js : le SDK Liquid Glass (version DOM,
 * sans React) et sa feuille de style ne sont téléchargés que si l'effet est actif.
 */
import '@glass-sdk/liquid-glass/styles.css';

export { createGlassScene } from '@glass-sdk/liquid-glass/dom';
