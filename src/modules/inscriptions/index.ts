export { InscriptionsPage } from './pages/InscriptionsPage';
export { CreateInscriptionDrawer } from './components/CreateInscriptionDrawer';
export { EditInscriptionDrawer } from './components/EditInscriptionDrawer';
export { DeleteInscriptionDialog } from './components/DeleteInscriptionDialog';
export { useInscriptionsList, useInscription, useCreateInscription, useUpdateInscription, useDeleteInscription } from './hooks/useInscriptions';
export type { Inscription, InscriptionInsert, InscriptionUpdate } from './hooks/useInscriptions';
export type { UIInscription } from './utils/inscriptionTransform';

