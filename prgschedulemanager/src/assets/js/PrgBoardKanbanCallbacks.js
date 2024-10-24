// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import AwStateService from 'js/awStateService';
import KanbanViewCallbacks from "js/KanbanViewCallbacks";
import viewModelObjectSvc from 'js/viewModelObjectService';

export default class PrgBoardKanbanCallbacks extends KanbanViewCallbacks {

    constructor( kanbanProps ) {
        super( kanbanProps );
    }

    onListAfterSelect( id, state, list ) {
        var selectedObjectUids = state._selected;
        var selectedObjects = [];
        for( var i = 0; i < selectedObjectUids.length; i++ ) {
            const uidWithSeparator = selectedObjectUids[ i ];
            const uidSplitArray = uidWithSeparator.split( '||' );
            var modelObject = cdm.getObject( uidSplitArray[ 0 ] );
            if( modelObject ) {
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObject );
                selectedObjects.push( vmo );
            }
        }
        let selectionData = this.kanbanProps.selectionData;
        const newSelectionData = { ...selectionData.value };
        newSelectionData.selected = selectedObjects;
        selectionData.update( newSelectionData );
    }

    onListAfterDrop( dragContext, e, list ) {
        // if we move an item from one list to another
        if( dragContext.from !== dragContext.to ) {
            var dragDropObject = {
                dragContext: _.cloneDeep( dragContext ),
                e: e,
                list: list,
                draggedObjectPrevIndexMap: this.draggedObjectPrevIndexMap
            };
            let atomicData = this.kanbanProps.atomicDataRef.kanbanState.getAtomicData();
            let atomicDataDestructured = { ...atomicData };
            atomicDataDestructured.operation = {
                action: 'dragDropCard',
                value: dragDropObject
            };
            this.kanbanProps.atomicDataRef.kanbanState.setAtomicData( atomicDataDestructured );
        }
    }
}
