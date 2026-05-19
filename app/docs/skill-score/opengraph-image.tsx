import { renderDocsOg, size, contentType } from '../../../lib/docs-og';

export { size, contentType };
export const alt = 'TOLDPROOF docs · Skill score';

export default function OG() {
  return renderDocsOg('skill-score');
}
