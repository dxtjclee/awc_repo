// Copyright (c) 2022 Siemens

/**
 * Service to provide utility methods to support showing Object Relations panel
 *
 * @module js/Ase0ShowObjectRelationsService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Filters the other end objects based on the property value match
 *
 * @param {Array} viewModelObjs - list of view model objects of other end objects
 * @param {String} filter - filter text
 * @return {Array} filtered list of view model objects
 */
export let checkFilter = function( viewModelObjs, filter ) {
    var rData = [];
    var filterText;
    if( !_.isEmpty( filter ) ) {
        filterText = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );
    }

    _.forEach( viewModelObjs, function( viewModelObj ) {
        if( filterText ) {
            var modelObj = cdm.getObject( viewModelObj.uid );
            // We have a filter, don't add nodes unless the filter matches a cell property
            var cellProps = modelObj.props.awp0CellProperties.dbValues;
            _.forEach( cellProps, function( property ) {
                var tmpProperty = property.toLocaleLowerCase().replace( /\\|\s/g, '' );
                if( tmpProperty.indexOf( filterText ) > -1 ) {
                    // Filter matches a property, add node to output elementList and go to next node
                    rData.push( viewModelObj );
                    return false;
                }
            } );
        } else {
            // No filter, just add the node to output elementList
            rData.push( viewModelObj );
        }
    } );
    return rData;
};

/**
 * Return true for processing connection
 *
 * @param {Object} data decl view model object - The declarative view model object
 * @return {Boolean} is connection tab active
 */
export let isProcessConnection = function( data ) {
    var isConnectionTabActive = 'false';
    if( data.selectedTab && data.selectedTab.tabKey && data.selectedTab.tabKey === 'connections' ) {
        isConnectionTabActive = 'true';
    }
    return isConnectionTabActive;
};

/**
 * Return true for processing tracelink
 *
 * @param {Object} data decl view model object - The declarative view model object
 * @return {Boolean} true for processing tracelink
 */
export let isProcessTracelink = function( data ) {
    var isProcessTracelinkTab = 'false';
    if( data.selectedTab && data.selectedTab.tabKey && data.selectedTab.tabKey === 'tracelinks' ) {
        isProcessTracelinkTab = 'true';
    }
    return isProcessTracelinkTab;
};

/**
 * update current selected tab
 *
 * @param {Object} data - The declarative data view model object
 * @param {Object} pageState - The Architecture page state
 * @returns {Boolean} lastSelectedTab
 */
export let updateTabSelection = function( data, pageState ) {
    if( pageState && pageState.activeTab && pageState.activeTab !== data.data.selectedTab.tabKey && data.lastSelectedTab ) {
        var tab = {
            tabKey: pageState.activeTab
        };
        eventBus.publish( 'awTab.setSelected', tab );
    } else {
        let activeTab = data.data.selectedTab.tabKey;
        pageState.activeTab = activeTab;
    }
    return {
        isLastSelectedTab: false
    };
};
export let setLastSelectedTab = function( data, pageState ) {
    if( pageState && pageState.activeTab ) {
        return {
            isLastSelectedTab: true
        };
    }
    let activeTab = appCtxSvc.getCtx( 'preferences.AWC_Relations_Panel_Tabs' )[ 0 ];
    pageState.activeTab = activeTab;
    return {
        isLastSelectedTab: false
    };
};

/**
 * Process the response and extract the relations from the related model objects
 * Filter and return list of related data
 *
 * @param {Object} data - response from SOA
 */
export let processSoaResponseFunc = function( data, subPanelContext ) {
    var rData = [];
    if( data.searchResults && data.searchResults.objects ) {
        rData = data.searchResults.objects;
    }
    data.relatedDataList.dbValue = rData;
    data.relatedDataFilterList.dbValue = data.relatedDataList.dbValue;
    let relationsPanel = {
        relationDataProvider: data.dataProviders.dataProviderRelatedNodeList
    };
    subPanelContext.graphState.relationsPanel = relationsPanel;
};

/**
 * Filter and return list of related data
 *
 * @param {Object} data - The view model data
 */
export let actionFilterList = function( data ) {
    // maintaining list of original data
    var rData = data.relatedDataList.dbValue;

    var filter = '';
    if( data.filterBox && data.filterBox.dbValue ) {
        filter = data.filterBox.dbValue;
    }

    if( rData.length > 0 ) {
        //update the list based on filter criteria
        data.relatedDataFilterList.dbValue = exports.checkFilter( rData, filter );
    }
};

/**
 * update inverse selection
 *
 * @param {Object} data - The view model data
 */
export let onInverseSelection = function( graphState ) {
    if( graphState && graphState.relationsPanel &&
        graphState.relationsPanel.relationDataProvider ) {
        var selectionModel = graphState.relationsPanel.relationDataProvider.selectionModel;
        //Toggle selection on every object in the list
        selectionModel.toggleSelection( graphState.relationsPanel.relationDataProvider.viewModelCollection.getLoadedViewModelObjects() );
    }
};

/**
 * The method joins the UIDs array (keys of elementToPCIMap) into a space-separated string/list.
 *
 * @return {String} Space seperated uids of all root elements in context
 */
export let getRootElementUids = function( occContext ) {
    var uidRootElements;
    if( occContext ) {
        if( occContext.elementToPCIMap ) {
            uidRootElements = Object.keys( occContext.elementToPCIMap ).join( ' ' );
        } else if( occContext.topElement ) {
            uidRootElements = occContext.topElement.uid;
        }
    }
    return uidRootElements;
};

/**
 * The method joins the UIDs array (values of elementToPCIMap) into a space-separated string/list.
 *
 * @return {String} Space seperated uids of all product context in context
 */
export let getProductContextUids = function( occContext ) {
    var uidProductContexts;
    if( occContext ) {
        if( occContext.elementToPCIMap ) {
            uidProductContexts = _.values( occContext.elementToPCIMap ).join( ' ' );
        } else if( occContext.productContextInfo ) {
            uidProductContexts = occContext.productContextInfo.uid;
        }
    }
    return uidProductContexts;
};

export default exports = {
    checkFilter,
    isProcessConnection,
    isProcessTracelink,
    updateTabSelection,
    setLastSelectedTab,
    processSoaResponseFunc,
    actionFilterList,
    onInverseSelection,
    getRootElementUids,
    getProductContextUids
};
