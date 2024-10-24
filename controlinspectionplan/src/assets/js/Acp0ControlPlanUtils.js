// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for control plan from quality center foundation module
 *
 * @module js/Acp0ControlPlanUtils
 */
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import parsingUtils from 'js/parsingUtils';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
var exports = {};

const editHandlerContextConstant = {
    CREATE: 'CREATE_PANEL_CONTEXT',
    REVISE: 'REVISE_PANEL_CONTEXT',
    SAVEAS: 'SAVEAS_PANEL_CONTEXT'
};

/**
 *This method ensures that the it return proper characteristics object to remove the relation from characteristics group
 */
export let getUnderlyingObject = function() {
    var selectedParent = {};
    let ctx = appCtxService.getCtx();
    if( ctx.pselected.modelType.typeHierarchyArray.indexOf( 'Acp0ControlPlanElement' ) > -1 ) {
        selectedParent.type = ctx.pselected.type;
        selectedParent.uid = ctx.pselected.props.awb0UnderlyingObject.dbValues[ 0 ];
    } else {
        selectedParent = ctx.pselected;
    }
    return selectedParent;
};

/**
 *This method is to concat all the partialError messages if any
 */
export let failureMessageConcat = function( data ) {
    //appCtxService.ctx.ErrorName = getErrorMessage( data.ServiceData.ServiceData.partialErrors[0].errorValues );

    var errors = data.ServiceData.ServiceData.partialErrors[ 0 ].errorValues;
    var errorMessage = '';

    for( var i = 0; i < errors.length; i++ ) {
        errorMessage += String( errors[ i ].message );
        if( i !== errors.length - 1 ) { errorMessage += '<BR/>'; }
    }

    appCtxService.ctx.ErrorName = errorMessage;
};

/**
 * This function will return the createInput information for creation of Control Plan object.
 * @param {ctx} - ctx object
 */
export let getCreateControlPlanInfo = function( ctx, editHandler ) {
    var strProps = {};
    var objectProps = {};
    var options = {};
    options.USE_SYSTEM_ELEMENT = false;
    options.COPY_INSP_DEF = true;

    let objectTypeIn = '_Cip0ControlPlan';
    if ( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if ( dataSource ) {
            let allEditableProperties = dataSource.getAllEditableProperties();
            allEditableProperties.forEach( ( vmProp ) => {
                if ( vmProp.type === 'STRING' && vmProp.dbValue !== null ) {
                    strProps[vmProp.propertyName] = vmProp.dbValue;
                }
                if ( vmProp.type === 'OBJECT' && vmProp.dbValue !== null ) {
                    objectProps[vmProp.propertyName] = vmProp.dbValue;
                }
                if ( vmProp.type === 'BOOLEAN' && vmProp.dbValue !== null ) {
                    if ( vmProp.propertyName === 'createOperation' ) {
                        options.USE_SYSTEM_ELEMENT = vmProp.dbValue;
                    }
                    if ( vmProp.propertyName === 'copyInspectionDefinition' ) {
                        options.COPY_INSP_DEF = vmProp.dbValue;
                    }
                }
            } );
        }
    }

    var createInput = { stringProps: strProps, referenceProps: objectProps };
    return {
        sourceObject: ctx.selected,
        controlPlanCreateInput: createInput,
        generateCPIPStructOptions: options
    };
};

export let setRunInBackgroundValue = function() {
    let ctx = appCtxService.getCtx();
    //Call Sync SOA when preference is set to true
    if( ctx.preferences && ctx.preferences.ACP0CONTROLPLAN_SOA_SYNC_CALL && ctx.preferences.ACP0CONTROLPLAN_SOA_SYNC_CALL[0].toUpperCase() === 'TRUE' ) {
        return false;
    }else if( ctx.preferences && ctx.preferences.ACP0CONTROLPLAN_SOA_SYNC_CALL && ctx.preferences.ACP0CONTROLPLAN_SOA_SYNC_CALL[0].toUpperCase() === 'FALSE' || !ctx.preferences.ACP0CONTROLPLAN_SOA_SYNC_CALL ) {
        return true; //Cal Async SOA when preference is set to false or preference is not available
    }
};

/**
 * Build SOA input for aligning CPIP structure
 * @param {Array} SelectedObjects - selected objects
 * @return {Object} Location Context
 */
export let buildInputToAlignCpipWithFmea = function( commandContext ) {
    var inputData = {};
    var srcFmeaObj = null;
    var targetControlPlanRevObj = null;
    var selectedObjects = [];

    srcFmeaObj = cdm.getObject( commandContext.baseSelection.props.aqc0SourceContext.dbValues[0] );
    targetControlPlanRevObj = cdm.getObject( commandContext.baseSelection.props.aqc0TargetContext.dbValues[0] );
    for ( let selectedObjIndex = 0; selectedObjIndex < commandContext.selectionData.selected.length; selectedObjIndex++ ) {
        var selectedObj = {};
        var selectedObject = {};
        selectedObj = commandContext.selectionData.selected[selectedObjIndex];

        selectedObject =
         {
             sourceParentElement : selectedObj.props.sourceParentElement.dbValue,
             targetParentElement :selectedObj.props.targetParentElement.dbValue,
             targetParentOccUid : selectedObj.props.targetParentOccUid.dbValue,
             sourceElement : selectedObj.props.sourceElement.dbValue,
             targetElement : selectedObj.props.targetElement.dbValue,
             targetOccUid : selectedObj.props.targetOccUid.dbValue
         };
        selectedObjects.push( selectedObject );
    }

    inputData = {
        sourceFMEAObject: {
            uid: srcFmeaObj.uid,
            type: srcFmeaObj.type
        },
        targetControlPlanRev: {
            uid: targetControlPlanRevObj.uid,
            type: targetControlPlanRevObj.type
        },
        useSourceObjectRevision: 'USE_SELECTED_REV',
        selectedObjects: selectedObjects
    };

    return inputData;
};
/**
 * function to fetch already activated rule object
 * @param {Object} data -  data
 * @return {Object} modelObject - already activated rule
 */
export let processOutput = function( data ) {
    var modelObject = {};
    if( data.ServiceData.plain !== undefined ) {
        modelObject = cdm.getObject( data.ServiceData.plain[0] );
    }
    return modelObject;
};

/**
 * Returns the created object of given type from the response from the object response.
 *
 * @param {Object} response - create soa resopnse
 * @param {string} type - create soa resopnse
 */
export let getCreatedObjectOfType = function( response, type ) {
    var charRevObject;
    if ( response.ServiceData && response.ServiceData.created ) {
        _.forEach( response.ServiceData.created, function( uid ) {
            if ( cdm.getObject( uid ) && cdm.getObject( uid ).type === type ) {
                charRevObject = cdm.getObject( uid );
                return false;
            }
        } );
    }
    return charRevObject;
};

/**
 * Returns the created representation element from the object response.
 *
 * @param {Object} response - addObject soa resopnse
 */
export let getCreatedRepresentationElement = function( response ) {
    return exports.getCreatedObjectOfType( response, 'Aqc0QcElement' );
};

export let getUpdatedDataforNewObject = function( data )  {
    data.data.underlyingObjects[0].props.item_revision_id.dbValues[0] = '';
    return data;
};

/**
 * Returns the created representation element from the object response.
 *
 * @param {Object} response - addObject soa resopnse
 */
export let getAddElementResponse = function( data ) {
    return {
        selectedNewElementInfo: data.selectedNewElementInfo,
        newlyAddedChildElements: _getNewlyAddedChildElements( data ),
        newElementInfos: data.newElementInfos,
        reloadContent: data.reloadContent,
        created: data.ServiceData.created,
        deleted: data.ServiceData.deleted,
        updated: data.ServiceData.updated,
        partialErrors: data.ServiceData.partialErrors
    };
};

/**
 * Returns the newly added child elemnent from the object response.
 *
 * @param {Object} response - addObject soa resopnse
 */
let _getNewlyAddedChildElements = function( data ) {
    // Collect the children for selected input parent.
    var newChildElements = [];

    if( data.selectedNewElementInfo.newElements ) {
        for( var i = 0; i < data.selectedNewElementInfo.newElements.length; ++i ) {
            newChildElements.push( data.selectedNewElementInfo.newElements[ i ] );
        }
    }

    // if the element is already present in newChildElements don't add it.
    var selectednewInfosize = newChildElements.length;
    var ctx = appCtxService.getCtx();
    if( ctx.aceActiveContext ) {
        var currentContext = ctx.aceActiveContext.key;
        var vmc = currentContext.vmc;
    }
    if( vmc ) {
        // Collect the children for other reused parent instances
        for( var j = 0; j < data.newElementInfos.length; j++ ) {
            var newElementInfo = data.newElementInfos[j];
            var parentIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
                return vmo.uid === newElementInfo.parentElement.uid;
            } );

            var parentVMO = vmc.getViewModelObject( parentIdx );

            // If parent is expanded then only add the children
            if( parentVMO && parentVMO.isExpanded ) {
                _.forEach( newElementInfo.newElements, function( newElement ) {
                    var found = 0;
                    for( var k = 0; k < selectednewInfosize; k++ ) {
                        found = 0;
                        if( newChildElements[k].uid === newElement.occurrenceId ) {
                            found = 1;
                            break;
                        }
                    }
                    if ( found === 0 ) {
                        newChildElements.push( newElement );
                    }
                } );
            }
        }
    }

    return newChildElements;
};

/**
 * Highlighting Inspection Definition objects on selection of PMI objects in NX application.
 */
export async function handlePmiSelectionChange(selectedPmiUIDs) {
    // Build the input to find Inspection Definition Revision(s) corresponding to given PMI UID.
    const findSavedQueriesSoaInput = {
        inputCriteria: [{
            queryNames: ['Inspection Definition Revision...'],
            queryType: 0
        }]
    };

    // Take query UID which find Inspection Definition Revision(s) corresponding to given PMI UID.
    var findSavedQueriesResponse = await soaSvc.postUnchecked('Query-2010-04-SavedQuery', 'findSavedQueries', findSavedQueriesSoaInput);

    // Find and select the Inspection Definition Revision(s) corresponding to given PMI UID.
    if (findSavedQueriesResponse.savedQueries && findSavedQueriesResponse.savedQueries.length > 0) {

        // Find the Inspection Definition Revision(s) corresponding to given PMI UID.
        var queryUid = findSavedQueriesResponse.savedQueries[0].uid;
        let inspDefsToSelect = [];
        let selectedInspDefsUIDs = [];
        if (selectedPmiUIDs.length > 0) {
            const promises = [];
            for (let pmiIndex = 0; pmiIndex < selectedPmiUIDs.length; pmiIndex++) {
                var pmiUid = selectedPmiUIDs[pmiIndex];
                promises.push(findInspectionDefinitionObjects(pmiUid, queryUid));
            }
            const findInspDefResponses = await Promise.all(promises);
            findInspDefResponses.forEach(findInspDefResponse => {
                for (var objectIndex = 0; objectIndex < findInspDefResponse.inspDefs.length; ++objectIndex) {
                    var inspectionDefinition = findInspDefResponse.inspDefs[objectIndex];
                    inspDefsToSelect.push(inspectionDefinition);
                    selectedInspDefsUIDs.push(inspectionDefinition.uid);
                }
            });         
        }

        // Select the Inspection Definition Revision(s) corresponding to given PMI UID.
        let inspDefsToHighlight = [];
        for (let inspDefsIndex = 0; inspDefsIndex < inspDefsToSelect.length; ++inspDefsIndex) {
            inspDefsToHighlight.push(inspDefsToSelect[inspDefsIndex]);
        }
        var occContext = appCtxService.getCtx('occmgmtContext');
        eventBus.publish('hosting.changeSelection', {
            operation: 'replace',
            objectsToSelect: inspDefsToSelect,
            objectsToHighlight: inspDefsToHighlight,
            selected: selectedInspDefsUIDs,
            viewkey: occContext.viewKey
        });
    }
}

/**
 * Get the input data to find Inspection Definition objects corresponding to the given PMI UID.
 */
function getInputToFindInspectionDefinitionObjects(pmiUid, queryUid) {

    // Replace special characters (%, _, [, ], -, ^, |, +, (, ), {, } and space) 
    // from pmiUid by "*" to search appropriate Inspection Definition objects.
    var charsToReplace = /[%_\[\]\-^|+(){} ]/g;
    var inputPmiUid = pmiUid.replace(charsToReplace, '*');
    var occContext = appCtxService.getCtx('occmgmtContext');

    // Build the input search Inspection Definition objects.
    var inputData = {
        searchInput: {
            attributesToInflate: [],
            columnFilters: [],
            cursor: {
                startIndex: 0,
                endIndex: 0,
                startReached: false,
                endReached: false
            },
            focusObjUid: "",
            internalPropertyName: "",
            maxToLoad: 100,
            maxToReturn: 100,
            pagingType: "",
            providerName: 'Awb0FullTextSearchProvider',
            searchCriteria: {
                aqc0PmiUid: inputPmiUid,
                Type: "Aqc0CharElementRevision",
                checkThreshold: "1",
                forceThreshhold: "true",
                includeConnections: "",
                lastEndIndex: "",
                productContextUids: occContext.productContextInfo.uid,
                productContextsToBeExcludedFromSearch: "",
                queryUID: queryUid,
                savedQueryUID: "",
                searchContext: occContext.productContextInfo.uid,
                searchID: "INSPECTION_DEFINITION_OBJECTS",
                searchScope: "",
                selectedLine: occContext.topElement.uid,
                totalObjectsFoundReportedToClient: "",
                typeOfSearch: "ADVANCED_SEARCH",
                useAlternateConfig: "true",
                utcOffset: "330"
            },
            searchFilterFieldSortType: "Priority",
            searchFilterMap6: {},
            searchSortCriteria: [],
            startIndex: 0
        }
    };

    return inputData;
}

/**
 * Find the Inspection Definition objects corresponding to the given PMI object.
 */
function findInspectionDefinitionObjects(pmiUid, queryUid) {
    var deferred = awPromiseService.instance.defer();

    // Build the input data to find Inspection Definition objects corresponding to the given PMI UID.
    var inputData = getInputToFindInspectionDefinitionObjects(pmiUid, queryUid);

    // Find Inspection Definition objects.
    soaSvc.postUnchecked('Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData).then((searchResponse) => {

        // Take Inspection Definition objects.
        let inspectionDefinitionElements = [];
        if (searchResponse.searchResultsJSON) {
            var searchResults = parsingUtils.parseJsonString(searchResponse.searchResultsJSON);
            if (searchResults) {
                for (var objectIndex = 0; objectIndex < searchResults.objects.length; ++objectIndex) {
                    var uid = searchResults.objects[objectIndex].uid;
                    var modelObject = cdm.getObject(uid);
                    inspectionDefinitionElements.push(modelObject);
                }
            }
        }

        // Resolve deferred result.
        deferred.resolve({
            inspDefs: inspectionDefinitionElements
        });
    });

    return deferred.promise;
}

export default exports = {
    getUnderlyingObject,
    failureMessageConcat,
    getCreateControlPlanInfo,
    setRunInBackgroundValue,
    buildInputToAlignCpipWithFmea,
    processOutput,
    getCreatedObjectOfType,
    getCreatedRepresentationElement,
    getUpdatedDataforNewObject,
    getAddElementResponse,
    handlePmiSelectionChange
};
