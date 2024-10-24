// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1VRBreadcrumbService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import columnArrangeService from 'js/columnArrangeService';
import AwPromiseService from 'js/awPromiseService';
import tcSessionData from 'js/TcSessionData';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import assert from 'assert';
import awTableSvc from 'js/awTableService';

var exports = {};

/**
  * buildNavigateBreadcrumb
  *
  * @param {IModelObject} selectedObjects - selected model objects
  * @return {Object} breadCrumbProvider bread crumb provider
  */
export let buildNavigateBreadcrumb = function( selectedObjects, subPanelContext ) {
    var breadCrumbProvider = {};
    breadCrumbProvider.crumbs = [];
    //selectedObjects = [ selectedObjects ];
    //here selectedObjects need to be pushed in array format
    if( selectedObjects.mselected && selectedObjects.mselected.length > 0  ) {
        selectedObjects = selectedObjects.mselected;
    } else{
        selectedObjects = [ subPanelContext.openedObject ];
    }
    //selectedObjects = selectedObjects.mselected[0];
    var modelObject = _.last( selectedObjects );
    if(modelObject && modelObject[0]){
        modelObject = modelObject[0];
    }
    if( !modelObject || _.isEmpty( modelObject.props ) ) {
        return breadCrumbProvider;
    }
    breadCrumbProvider = exports.insertCrumbsFromModelObject( modelObject, breadCrumbProvider, subPanelContext );
    if( breadCrumbProvider && breadCrumbProvider.crumbs && breadCrumbProvider.crumbs.length > 0 ) {
        breadCrumbProvider.crumbs[ breadCrumbProvider.crumbs.length - 1 ].selectedCrumb = true;
        breadCrumbProvider.crumbs[ 0 ].primaryCrumb = true;
    }
    return breadCrumbProvider;
};

/**
  * insertCrumbsFromModelObject
  *
  * @param {IModelObject} modelObject - model object
  * @param {Object} breadCrumbProvider - bread crumb provider
  * @return {Object} bread crumb provider
  */
 export let insertCrumbsFromModelObject = function( modelObject, breadCrumbProvider, subPanelContext ) {
    var props;
    if( modelObject && modelObject.props && modelObject.props.object_string && breadCrumbProvider ) {
        props = modelObject.props;
        var crumb = {
            displayName: props.object_string.uiValues[ 0 ],
            showArrow: props.crt0ChildrenStudies ? props.crt0ChildrenStudies.dbValues.length > 0 : true,
            selectedCrumb: false,
            scopedUid: modelObject.uid,
            clicked: false,
            subPanelContext:subPanelContext,
            onCrumbClick: ( crumb ) => _onSelectCrumb( subPanelContext, crumb )
        };

        breadCrumbProvider.crumbs.splice( 0, 0, crumb );

        var parentUid = null;
        if( props.crt0ParentVldnContract && !_.isEmpty( props.crt0ParentVldnContract.dbValue ) ) {
            parentUid = props.crt0ParentVldnContract.dbValues[ 0 ];
        }

        //= occmgmtUtils.getParentUid( modelObject );
        if( parentUid ) {
            var parentModelObj = cdm.getObject( parentUid );

            if( parentModelObj ) {
                return exports.insertCrumbsFromModelObject( parentModelObj, breadCrumbProvider, subPanelContext );
            }
        } else {
            // When the root object is not type of Awb0Element
            if( modelObject.modelType && modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) === -1 ) {
                var openedObject = cdm.getObject( subPanelContext.openedObject.uid );
                // And the root object is not the opened object
                if( openedObject.uid !== modelObject.uid ) {
                    // Add the opened object as the first node of the breadcrumb
                    var crumbOpenedObject = {
                        displayName: openedObject.props.object_string.uiValues[ 0 ],
                        showArrow: true,
                        selectedCrumb: false,
                        scopedUid: openedObject.uid,
                        clicked: false,
                        subPanelContext:subPanelContext,
                        onCrumbClick: ( crumb ) => _onSelectCrumb( subPanelContext, crumb )
                    };

                    breadCrumbProvider.crumbs.splice( 0, 0, crumbOpenedObject );
                }
            }
        }
    }
    return breadCrumbProvider;
};

export let _onSelectCrumb = function( subPanelContext, crumb ) {
    exports.onSelectBreadcrumb( crumb, subPanelContext );
};

/**
  * @param {Object} selectedCrumb - selected crumb object
  * @param {String} subPanelContext - subPanelContext
  */
 export let onSelectBreadcrumb = function( selectedCrumb, subPanelContext ) {
    var elementToSelect = cdm.getObject( selectedCrumb.scopedUid );
    let selectionsToModify = {};
    if( elementToSelect.modelType && elementToSelect.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) === -1 ) {
        selectionsToModify.clearExistingSelections = true;
    }else {
        selectionsToModify = {
            elementsToSelect: [ elementToSelect ]
        };
    }
    eventBus.publish( 'vrPWATreeTable.setSelection', selectionsToModify );
    var newVrSublocationState = { ...subPanelContext.vrSublocationState.value };
    newVrSublocationState.mselected = [];
    newVrSublocationState.mselected.push( elementToSelect );
    subPanelContext.vrSublocationState.update && subPanelContext.vrSublocationState.update( newVrSublocationState );
};

/**
 * loadData
 *
 *
 * @param {ListLoadInput} listLoadInput -
 * @member dynamicTableUtils
 * @param {IModelObject} openedObject -
 * @param {OccCursorObject} cursorObject -
 *
 * @return {Promise} Promise resolves with the resulting ListLoadResult object.
 */

export let loadData = function() {
    /**
     * Extract action parameters from the argument to this function.
     */
    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].listLoadInput, 'Missing argument property' );
    let listLoadInput = arguments[ 0 ].listLoadInput;
    let selectedChevronEle = cdm.getObject( listLoadInput.parentUid );
    let childrenUids = selectedChevronEle.props.crt0ChildrenStudies.dbValues;
    var childOccurrences = [];
    _.forEach( childrenUids, function( childUid ) {
        var childInfo = cdm.getObject( childUid );
        childOccurrences.push( childInfo );
    } );
    var totalChildCount = childOccurrences.length;
    var cursor = {
        endIndex: totalChildCount,
        endOccUid:'',
        endReached: true,
        pageSize: 15,
        startIndex: 0,
        startOccUid: '',
        startReached: true
    };
    var parentOccurrence = {
        displayName : '',
        numberOfChildren: totalChildCount,
        occurrence : selectedChevronEle,
        occurrenceId: listLoadInput.parentUid,
        stableId:'',
        underlyingObjectType:''
    };
    var listLoadResult = awTableSvc.createListLoadResult( parentOccurrence,
        childOccurrences, totalChildCount, 0, parentOccurrence );
    /** List Specific load result properties */
    listLoadResult.cursorObject = cursor;
    return {
        listLoadResult: listLoadResult
    };
};

export let navigateToBreadcrumbSelectedObject = function( selection, subPanelContext, { chevronPopup } ) {
    var elementToSelect = cdm.getObject( selection[0].uid );
    let selectionsToModify = {};
    selectionsToModify = {
        elementsToSelect: [ elementToSelect ]
    };
    eventBus.publish( 'vrPWATreeTable.setSelection', selectionsToModify );
    var newVrSublocationState = { ...subPanelContext.vrSublocationState.value };
    newVrSublocationState.mselected = [];
    newVrSublocationState.mselected.push( elementToSelect );
    subPanelContext.vrSublocationState.update && subPanelContext.vrSublocationState.update( newVrSublocationState );
    if( chevronPopup ) {
        chevronPopup.hide();
    }
};

export let showChildOccurencesInPWA = function( vmo, contextKey ) {
    console.log( 'show children' );
    let levelNdx = 1;
    let isExpanded = true;
    var targetTreeNode =  vmo;
    targetTreeNode.isExpanded = isExpanded;
    targetTreeNode.levelNdx = 1;
    targetTreeNode.id = vmo.uid;
};


/**
  * Returns the Crt1VRBreadcrumbService instance
  *
  * @member Crt1VRBreadcrumbService
  */

export default exports = {
    buildNavigateBreadcrumb,
    insertCrumbsFromModelObject,
    onSelectBreadcrumb,
    loadData,
    navigateToBreadcrumbSelectedObject,
    showChildOccurencesInPWA
};
