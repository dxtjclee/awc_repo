// Copyright (c) 2022 Siemens

/**
 * @module js/Crt1AddTestCaseService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import addObjectUtils from 'js/addObjectUtils';
import awSearchService from 'js/awSearchService';

var exports = {};

export let getTracelinkInput = function( data, sourceObjects ) {
    appCtxSvc.registerCtx( 'expandNode', true );
    var objInput = [];
    var underlyingObj = [];
    var type = '';
    var uid = '';
    var secondaryObjects = data.addPanelState.sourceObjects;
    var activeTab = data.addPanelState.selectedTab.tabKey;
    var treeProxyNode = sourceObjects;
    if( treeProxyNode && treeProxyNode.length > 0 && treeProxyNode[ 0 ].props && treeProxyNode[ 0 ].props.crt1UnderlyingObject &&
        treeProxyNode[ 0 ].props.crt1UnderlyingObject.dbValues && treeProxyNode[ 0 ].props.crt1UnderlyingObject.dbValues[ 0 ] ) {
        underlyingObj = cdm.getObject( treeProxyNode[ 0 ].props.crt1UnderlyingObject.dbValues[ 0 ] );
    }else if ( treeProxyNode && treeProxyNode.length > 0 && treeProxyNode[ 0 ].props && treeProxyNode[ 0 ].props.awb0UnderlyingObject &&
        treeProxyNode[ 0 ].props.awb0UnderlyingObject.dbValues && treeProxyNode[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] ) {
        underlyingObj = cdm.getObject( treeProxyNode[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] );
    }else if( appCtxSvc.ctx.mselected && appCtxSvc.ctx.mselected.length > 0 && appCtxSvc.ctx.mselected[ 0 ].props && appCtxSvc.ctx.mselected[ 0 ].props.awb0UnderlyingObject ) {
        underlyingObj = cdm.getObject( appCtxSvc.ctx.mselected[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    if( underlyingObj ) {
        type = underlyingObj.type;
        uid = underlyingObj.uid;
    }
    if( data && data.createdObject ) {
        objInput = [ {
            clientId: '',
            primaryObj: {
                type: type,
                uid: uid
            },
            requestPref: {},
            secondaryObj: {
                type: data.createdObject.type,
                uid: data.createdObject.uid
            },
            tracelinkCreateInput: {
                boName: 'IAV0Verify',
                compoundCreateInput: {},
                propertyNameValues: {}
            }
        } ];
    } else if( secondaryObjects && ( activeTab === 'search' || activeTab === 'palette' ) ) {
        for( var i = 0; i < secondaryObjects.length; i++ ) {
            var object = {
                clientId: '',
                primaryObj: {
                    type: type,
                    uid: uid
                },
                requestPref: {},
                secondaryObj: {
                    type: secondaryObjects[ i ].type,
                    uid: secondaryObjects[ i ].uid
                },
                tracelinkCreateInput: {
                    boName: 'IAV0Verify',
                    compoundCreateInput: {},
                    propertyNameValues: {}
                }
            };
            objInput.push( object );
        }
    }
    return objInput;
};
/**
 * Add source objects to dataProvider
 * @param {Object} data Data
 */
export let addTestCase = function( data ) {
    if( data.eventData.selectedObjects && data.eventData.selectedObjects.length > 0 ) {
        data.eventData.selectedObjects[ 0 ].selected = false;
        data.dataProviders.getAddedTestCaseProvider.update( data.eventData.selectedObjects, data.eventData.selectedObjects.length );
    }
};
/**
 * Remove source objects to dataProvider
 * @param {Object} data Data
 */
export let removeTestCase = function( data ) {
    if( data.dataProviders.getAddedTestCaseProvider.selectedObjects &&  data.dataProviders.getAddedTestCaseProvider.selectedObjects.length > 0 ) {
        var sourceObjects =  data.dataProviders.getAddedTestCaseProvider.selectedObjects;
        sourceObjects.splice( 0 );
        data.dataProviders.getAddedTestCaseProvider.update( sourceObjects, sourceObjects.length );
    }
};
/**
 * Return create input representation.
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} creationType - The creationType
 * @param {Object} editHandler - The editHandler
 */
export let getCreateInput = function( data, creationType, editHandler ) {
    var createInput = addObjectUtils.getCreateInput( data, null, creationType, editHandler );
    return createInput;
};
export let getCreatedObject = function( response ) {
    var createdModelObject = null;
    var createdObjects = addObjectUtils.getCreatedObjects( response );
    if( createdObjects && createdObjects.length > 0 ) {
        createdModelObject = createdObjects[ 0 ];
    }
    return createdModelObject;
};
export let getSearchStringValue = function( data ) {
    if( data.filterBox && data.filterBox.dbValue === '' ) {
        return 'RequirementSpec Revision';
    }
    return data.filterBox.dbValue;
};
/**
 * Get the type names.
 * @param {Object} response findDisplayableSubBusinessObjectsWithDisplayNames response
 * @return {Object} type names
 */
 export let processSoaResponseForBOTypes = function( response ) {
    let typeNames = [];
    if( response.output ) {
        for( let ii = 0; ii < response.output.length; ii++ ) {
            let displayableBOTypeNames = response.output[ ii ].displayableBOTypeNames;
            for( let jj = 0; jj < displayableBOTypeNames.length; jj++ ) {
                let searchFilter = {
                    searchFilterType: 'StringFilter',
                    stringValue: ''
                };
                searchFilter.stringValue = displayableBOTypeNames[ jj ].boName;
                typeNames.push( searchFilter );
            }
        }
    }
    return typeNames;
};
/**
 * Get the specification selected on specification panel
 * @param {Object} data viewModel data 
 */
export let getSelectedSpecification = function (data) {
    var sourceObjects = data.dataProviders.getAddedTestCaseProvider.viewModelCollection.getLoadedViewModelObjects();
    return {
        type: sourceObjects[0].type,
        uid: sourceObjects[0].uid
    };
};
/**
 * Get the created test case
 * @param {Object} data viewModel data 
 */
 export let getCreatedTestCase = function (data) {
    var tcObj = data.createdObject;
    return {
        type: tcObj.type,
        uid: tcObj.uid
    };
};

export default exports = {
    getTracelinkInput,
    addTestCase,
    removeTestCase,
    getCreateInput,
    getCreatedObject,
    getSearchStringValue,
    processSoaResponseForBOTypes,
    getSelectedSpecification,
    getCreatedTestCase
};
