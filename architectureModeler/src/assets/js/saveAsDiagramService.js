// Copyright (c) 2022 Siemens

/**
 * Service responsible for creating, updating and copying Saved Working Context
 *
 * @module js/saveAsDiagramService
 */
import appCtxService from 'js/appCtxService';
import addObjectUtils from 'js/addObjectUtils';
import viewModelObjectService from 'js/viewModelObjectService';
import localeService from 'js/localeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';

var exports = {};
var _data = null;

export let navigateAndCreateInput = function( data ) {
    let prop = null;
    if( !data.eventData ) {
        return;
    }

    if( data.eventData && data.eventData.selectedObjects ) {
        if( data.eventData.selectedObjects.length === 0 ) {
            if( data.dataProviders.awTypeSelector &&
                data.dataProviders.awTypeSelector.selectedObjects.length === 1 ) {
                prop = data.dataProviders.awTypeSelector.selectedObjects[ 0 ];
            }
        } else {
            prop = data.eventData.selectedObjects[ 0 ];
        }
    }

    eventBus.publish( 'StartSaveAutoBookmarkEvent' );
    return {
        creationType: prop
    };
};

export let saveDiagramCreateInput = function( data, occMgmnt, pageContext, editHandler ) {
    let creationType = data.creationType ? data.creationType.object : null;
    var createInput = addObjectUtils.getCreateInput( data, null, creationType, editHandler );
    var diagSelectedUid = occMgmnt.workingContextObj.uid;
    var object = null;
    var openedDiagram = null;
    if( viewModelObjectService && diagSelectedUid ) {
        object = viewModelObjectService.createViewModelObject( diagSelectedUid, 'EDIT' );
        if( object ) {
            openedDiagram = object;
        }
    }

    if( pageContext && pageContext.secondaryActiveTabId && pageContext.secondaryActiveTabId === 'Ase0ArchitectureFeature' ) {
        // In case of Architecture tab send autobookmark for save as action
        createInput[ 0 ].createData.propertyNameValues.awb0SourceAutoBookmark = [ occMgmnt.productContextInfo.props.awb0AutoBookmark.dbValues[ 0 ] ];
    } else if ( openedDiagram ) {
        createInput[ 0 ].createData.propertyNameValues.awb0SourceAutoBookmark = [ openedDiagram.uid ];
    }

    var diagramObject = [ openedDiagram ];
    diagramObject.push();

    var input = [];
    var inputData = {
        clientId: 'SaveAsDiagram',
        userAction: 'SaveAsDiagram',
        primaryObjects: diagramObject,
        secondaryObjects: [],
        createInput: createInput[ 0 ].createData,
        inputCtxt: {
            productContext: occMgmnt.productContextInfo
        }
    };

    input.push( inputData );
    return input;
};

/**
 * Get created object. Return ItemRev if the creation type is Item.
 *
 * @param {Object} response the response of createRelateAndSubmitObjects SOA call
 * @return  {Object} object
 */
export let getCreatedObject = function( response ) {
    var object = null;
    if( response && response.ServiceData.created[ 0 ] ) {
        var objectUid = response.ServiceData.created[ 0 ];
        if( viewModelObjectService ) {
            object = viewModelObjectService.createViewModelObject( objectUid, 'EDIT' );
        }
    } else {
        logger.error( 'SaveAsDiag:ERROR - during save as diagram.' );
    }
    return object;
};

var clearSelectedType = function() {
    if( _data ) {
        _data.creationType = null;
    }
};

/**
 * Auto populate XRT panel fields: 'object_name' for SAVE AS operation.
 *
 * @param {Object} data - Save As Diagram panel's data object
 */
export let populateSaveAsDiagramPanel = function( data, diagramSelected ) {
    var diagSelectedUid = diagramSelected;
    var displayName = null;
    var object = null;
    if( viewModelObjectService && diagSelectedUid ) {
        object = viewModelObjectService.createViewModelObject( diagSelectedUid, 'EDIT' );
    }
    if( object ) {
        if( object.props && object.props.object_name && object.props.object_name.uiValues &&
            object.props.object_name.uiValues.length > 0 ) {
            displayName = object.props.object_name.uiValues[ 0 ];
            //Auto-assigned Name = openedObjectName + "-COPY";
            displayName = getLocalizedMessage( 'ArchitectureModelerMessages',
                'saveAsDiagramName', displayName );
            if ( data ) {
                const viewModelsProps = [ {
                    propertyName: 'object_name',
                    dbValue: displayName
                } ];
                addObjectUtils.assignInitialValues( viewModelsProps, data.creationType.object.props.type_name.dbValues[0], null );
                data.object_name.dbValue = displayName;
                data.object_name.valueUpdated = true;
            }
        }
    }
};

export let initNavigateFunction = function( data ) {
    _data = data;

    eventBus.publish( 'StartSaveAutoBookmarkEvent' );
    return{
        clearSelectedType: data.clearSelectedType
    };
};

/**
 * Update Ctx for pending changes in diagram.
 * @param {Object} graphState graphState
 *
 */
export let updateCtxForPendingChangesInDiagram = function( graphState ) {
    const newGraphState = { ...graphState.value };
    var hasPendingChangesInDiagram = _.get( graphState, 'hasPendingChangesInDiagram', false );

    if( hasPendingChangesInDiagram ) {
        _.set( appCtxService, 'ctx.architectureCtx.diagram.leaveConfFromSaveAsDiagram', true );
        newGraphState.hasPendingChangesInDiagram = false;
    }
    graphState.update && graphState.update( newGraphState );
};

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {Object} resourceFile - File that defines the message
 * @param {String} resourceKey - The message key which should be looked-up
 * @param {String} messageParam - The message parameter
 * @returns {String} localizedValue - The localized message string
 */
function getLocalizedMessage( resourceFile, resourceKey, messageParam ) {
    var localizedValue = null;
    var localTextBundle = localeService.getLoadedText( resourceFile );
    if( localTextBundle ) {
        localizedValue = localTextBundle[ resourceKey ].replace( '{0}', messageParam );
    } else {
        var asyncFun = function( localTextBundle ) {
            localizedValue = localTextBundle[ resourceKey ].replace( '{0}', messageParam );
        };
        localeService.getTextPromise( resourceFile ).then( asyncFun );
    }
    return localizedValue;
}

export default exports = {
    navigateAndCreateInput,
    saveDiagramCreateInput,
    getCreatedObject,
    populateSaveAsDiagramPanel,
    initNavigateFunction,
    updateCtxForPendingChangesInDiagram
};
