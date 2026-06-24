type ContractSignoffInput = {
  id: number;
  name: string;
  documentId?: number | null;
  documentTitle?: string | null;
};

export function buildContractSignoffUrl(contract: ContractSignoffInput): string | null {
  if (!contract.documentId) return null;
  const params = new URLSearchParams({
    compose: "1",
    crmContractId: String(contract.id),
    crmContractTitle: contract.name,
    jigantoDocId: String(contract.documentId),
    jigantoDocTitle: contract.documentTitle || contract.name,
  });
  return `/modules/e-sign?${params.toString()}`;
}
