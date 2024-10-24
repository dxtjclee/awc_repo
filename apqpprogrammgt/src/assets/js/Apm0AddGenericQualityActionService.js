// Copyright (c) 2022 Siemens

/**
 * @module js/Apm0AddGenericQualityActionService
 */

var exports = {};

export let setQualityActionTypeSubTypeRelationInfo = function( ctx ) {
    let genericQualityActionRelation = {};

    genericQualityActionRelation.type = 'Program';

    if( ctx.sublocation.clientScopeURI === 'Psi0Checklist' || ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Psi0Checklist' ) > -1 ) {
        genericQualityActionRelation.subType = 'Checklist';
        genericQualityActionRelation.relationType = 'Apm0ChecklistQualityActRel';
    } else if( ctx.sublocation.clientScopeURI === 'Psi0ChecklistQuestion' || ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'Psi0ChecklistQuestion' ) > -1 ) {
        genericQualityActionRelation.subType = 'Checklist Question';
        genericQualityActionRelation.relationType = 'Apm0ChecklistQQualityActRel';
    }
    if( ctx.selected.modelType.typeHierarchyArray.indexOf( 'Qam0QualityAction' ) > -1 ) {
        genericQualityActionRelation.primaryObj = ctx.xrtSummaryContextObject;
    } else {
        genericQualityActionRelation.primaryObj = ctx.selected;
    }
    return genericQualityActionRelation;
};

export default exports = {
    setQualityActionTypeSubTypeRelationInfo
};
