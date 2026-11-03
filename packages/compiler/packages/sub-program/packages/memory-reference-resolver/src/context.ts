import type {
	LocalMap,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	PlannedMemoryModule,
	ProjectMemoryAliasLookup,
	ReferenceSlotMap,
} from '@8f4e/language-spec';

export type MemoryReferenceModuleNamespace = PlannedMemoryModule;

export type MemoryReferencePointerMetadataByModuleId = Record<string, MemoryPointerMetadataMap>;

export interface MemoryReferenceResolutionContext {
	referenceSlots: ReferenceSlotMap;
	memoryPlan: MemoryLayoutPlan;
	memoryAliases: ProjectMemoryAliasLookup;
	currentModule?: PlannedMemoryModule;
	pointerMetadata: MemoryReferencePointerMetadataByModuleId;
	moduleName?: string;
	locals: LocalMap;
}
