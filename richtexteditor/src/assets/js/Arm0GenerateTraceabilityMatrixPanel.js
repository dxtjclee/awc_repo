// Copyright (c) 2022 Siemens

/**
 * This provides functionality related to traceability matrix to replace the structure after matrix gets generated
 * @module js/Arm0GenerateTraceabilityMatrixPanel
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import adapterService from 'js/adapterService';
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';

var exports = {};
var selectedMatrixType = '';
var selectedSourceObjects = null;
var selectedSourcePCI = { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' };
var selectedTargetObjects = null;
var selectedTargetPCI = { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' };

/**
 * Set the selected objects on search panel.
 * @param {Object} data - the viewmodel data for this panel
 * @param {Object} selectedObjects - selected objects on search results
 * @param {Object} ctx - context object
 */
export let handleSearchSelection = function( data, selectedObjects, ctx ) {
    if( selectedObjects.length > 0 ) {
        data.selectedObject = selectedObjects[ 0 ];
    } else {
        data.selectedObject = undefined;
    }
    exports.updateUIOnSelectionChange( ctx, data, selectedMatrixType );
};

/**
 * Method gets called when user changes the type of matrix in drop down
 * @param {Object} data - the viewmodel data for this panel
 * @param {Object} ctx - context object
 * @return {Object} { } - Object.
 */
export let updateSelectedMatrixType = function( data, ctx ) {
    selectedMatrixType = data.matrixTypeListBox.dbValue;
    return exports.updateUIOnSelectionChange( ctx, data, selectedMatrixType );
};

/**
 * Set the selected objects on search panel.
 * @param {Object} ctx - context object
 * @param {Object} data - the viewmodel data for this panel
 * @param {Object} selectedMatrixType - selected matrix type in drop down
 * @return {Object} { } - Object.
 */
export let updateUIOnSelectionChange = function( ctx, data, selectedMatrixType ) {
    if( selectedMatrixType === 'Quick Matrix' || selectedMatrixType === 'Full-Rollup Matrix' ) {
        if( data.selectedObject !== undefined ) {
            return self.updateUIFields( true, true, data );
        }
        if( ctx.mselected.length === 2 ) {
            return self.updateUIFields( true, false, data );
        } else if( data.symmectricMatrix.dbValue ) {
            return self.updateUIFields( true, true, data );
        }
        return self.updateUIFields( false, true, data );
    }
    return self.updateUIFields( true, false, data );
};

/**
 * this method checks for all combination possible to generate the traceability matrix.
 * @param {Object} ctx - context object
 * @param {Object} data - the viewmodel data for this panel
 * @return {Object} { } - Object.
 */
export let validateSelection = function( ctx, data ) {
    var selectedObjs = ctx.mselected;
    if( selectedObjs.length === 1 ) {
        var isFolder = self.isFolder( selectedObjs[ 0 ] );
        var isItemRevision = self.isItemRevision( selectedObjs[ 0 ] );
        var isOccurrence = self.isOccurrence( selectedObjs[ 0 ] );

        if( isFolder ) {
            if( data.selectedObject !== undefined ) {
                var objs = self.updateApplicableMatrixTypesArray( true, true, false, data );
                data.matrixTypeListBoxValues = _getMatrixTypeVMO( objs );
            } else {
                objs = self.updateApplicableMatrixTypesArray( true, false, true, data );
                data.matrixTypeListBoxValues = _getMatrixTypeVMO( objs );
            }
        } else if( isItemRevision || isOccurrence ) {
            objs = self.updateApplicableMatrixTypesArray( true, true, true, data );
            data.matrixTypeListBoxValues = _getMatrixTypeVMO( objs );
        } else {
            objs = self.updateApplicableMatrixTypesArray( false, false, true, data );
            data.matrixTypeListBoxValues = _getMatrixTypeVMO( objs );
        }
    } else if( selectedObjs.length === 2 ) {
        var i;
        var isNotSupportedObjects = false;
        for( i = 0; i < 2; i++ ) {
            if( !self.isFolder( selectedObjs[ i ] ) && !self.isItemRevision( selectedObjs[ i ] ) && !self.isOccurrence( selectedObjs[ i ] ) ) {
                isNotSupportedObjects = true;
                break;
            }
        }
        if( self.isFolder( ctx.mselected[ 0 ] ) && self.isFolder( ctx.mselected[ 1 ] ) ) {
            var objs = self.updateApplicableMatrixTypesArray( true, false, true, data );
            data.matrixTypeListBoxValues = _getMatrixTypeVMO( objs );
        } else if( !isNotSupportedObjects ) {
            objs = self.updateApplicableMatrixTypesArray( true, true, true, data );
            data.matrixTypeListBoxValues = _getMatrixTypeVMO( objs );
        } else {
            var objs = self.updateApplicableMatrixTypesArray( false, false, true, data );
            data.matrixTypeListBoxValues = _getMatrixTypeVMO( objs );
            //only dynamic matrix can be generated as there are some invalid objects selected by user which server does not understand
        }
    } else if( selectedObjs.length > 2 ) {
        data.matrixTypeListBoxValues =  _getMatrixTypeVMO( self.updateApplicableMatrixTypesArray( false, false, true, data ) );
    }
    var matrixTypeListBoxValues =  data.matrixTypeListBoxValues;
    var matrixTypeListBox = data.matrixTypeListBox;
    data.matrixTypeListBox.dbValue = data.matrixTypeListBoxValues[0].propInternalValue;
    selectedMatrixType = data.matrixTypeListBox.dbValue;
    data.matrixTypeListBox.uiValue = data.matrixTypeListBoxValues[0].propDisplayValue;

    var { matrixButtonVal, showSearchVal } = exports.updateUIOnSelectionChange( ctx, data, selectedMatrixType );

    return {
        matrixTypeListBoxValues,
        matrixTypeListBox,
        matrixButtonVal,
        showSearchVal
    };
};


/**
 * Return an empty ListModel object.
 * @param {Object} objs - Empty ListModel object.
 * @return {Object} matrixTypes- Empty ListModel object.
 */
var _getMatrixTypeVMO = function( objs ) {
    var matrixTypes = [];
    for( var i = 0; i < objs.length; i++ ) {
        var output = objs[ i ];
        if( output ) {
            var listModel = _getEmptyListModel();
            listModel.propDisplayValue = output.propDisplayValue;
            listModel.propInternalValue = output.propInternalValue;
            matrixTypes.push( listModel );
        }
    }
    return matrixTypes;
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Method to update the matrix types array which will be shown to user in drop down list
 * @param {Object} isQuickMatrixApplicable - boolean to decide whether to show quick matrix in options
 * @param {Object} isFullMatrixApplicable - boolean to decide whether to show quick matrix in options
 * @param {Object} isDynamicMatrixApplicable - boolean to decide whether to show quick matrix in options
 * @returns {Object} matrixTypeValues - Array that contains applicable values
 */
self.updateApplicableMatrixTypesArray = function( isQuickMatrixApplicable, isFullMatrixApplicable, isDynamicMatrixApplicable, data ) {
    var matrixTypeValues = [];
    if( isQuickMatrixApplicable ) {
        matrixTypeValues.push( {
            propDisplayValue: data.i18n.QuickMatrix,
            propInternalValue: 'Quick Matrix'
        } );
    }
    if( isFullMatrixApplicable ) {
        matrixTypeValues.push( {
            propDisplayValue: data.i18n.FullRollup,
            propInternalValue: 'Full-Rollup Matrix'
        } );
    }
    if( isDynamicMatrixApplicable ) {
        matrixTypeValues.push( {
            propDisplayValue: data.i18n.Dynamic,
            propInternalValue: 'Dynamic Matrix'
        } );
    }
    return matrixTypeValues;
};

/**
 * This method updates the fields in UI accorsing to the values provided
 * @param {Boolean} matrixButtonVal - boolean to enable/disable button
 * @param {Boolean} showSearchVal - boolean to hide/unhide the search field
 * @param {Object} data - data object of the view model
 */
self.updateUIFields = function( matrixButtonVal, showSearchVal, data ) {
    data.isMatrixButtonEnabled = matrixButtonVal;
    data.isShowSearch = showSearchVal;
    return { matrixButtonVal, showSearchVal };
};

/**
 * This method checks whether the given object is instance of folder or not
 * @param {Object} selectedObj - object selected by user
 * @returns {Boolean} true/false
 */
self.isFolder = function( selectedObj ) {
    if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * This method checks whether the given object is instance of ItemRevision or not
 * @param {Object} selectedObj - object selected by user
 * @returns {Boolean} true/false
 */
self.isItemRevision = function( selectedObj ) {
    if( selectedObj.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * This method checks whether the given object is instance of occurrence or not
 * @param {Object} selectedObj - object selected by user
 * @returns {Boolean} true/false
 */
self.isOccurrence = function( selectedObj ) {
    if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * util checks data if is defined.
 * @param {Object} isvalid some value
 * @returns {string} value if true/"" if false
 */
self.isDataValid = function( isvalid ) {
    if( isvalid ) {
        return isvalid;
    }
    return '';
};

/**
 * Check Is Occurence.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {boolean} true/false
 */
var _isOccurence = function( obj ) {
    if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        return true;
    }
    return false;
};
/**
 * Check Is RunTime Object.
 *
 * @param {Object} obj - Runtime object
 * @return {boolean} true/false
 */
var _isRunTimeObject = function( obj ) {
    if( commandsMapService.isInstanceOf( 'RuntimeBusinessObject', obj.modelType ) ) {
        return true;
    }
    return false;
};
/**
 * Get updated array of underlying objects for Runtime objects(Other then Awb0Element).
 *
 * @param {Object} arryObjs - array of Runtime object
 * @return {boolean} true/false
 */
var _getUnderlyingObjects = function( arryObjs ) {
    var arrObjsResult = [];
    _.forEach( arryObjs, function( obj ) {
        var tmpObj = cdm.getObject( obj.uid );
        if ( !_isOccurence( tmpObj ) && _isRunTimeObject( tmpObj ) ) {
            var srcObjs = adapterService.getAdaptedObjectsSync( [ tmpObj ] );
            if ( srcObjs !== null && srcObjs.length > 0 ) {
                tmpObj = srcObjs[0];
            }
        }
        arrObjsResult.push( tmpObj );
    } );
    return arrObjsResult;
};

/**
 * This method will generate the traceability matrix
 * @param {Object} data - data object of view model
 * @param {Object} ctx - context object
 */
export let generateTraceabilityMatrix = function( data, ctx ) {
    if( selectedMatrixType === 'Quick Matrix' ) {
        appCtxService.registerCtx( 'matrixType', 'Quick Matrix' );
        var { sourcePCI, targetPCI, source, target } = self.setMatrixSourceTarget( data, ctx );
        appCtxService.registerCtx( 'sourceObjects', [ data.source ] );
        selectedSourceObjects = [ data.source ];
        selectedSourcePCI = data.sourcePCI;
        appCtxService.registerCtx( 'targetObjects', [ data.target ] );
        selectedTargetObjects = [ data.target ];
        selectedTargetPCI = data.targetPCI;
        eventBus.publish( 'requirements.handleGenerateTraceabilityMatrixCommand' );
    } else if( selectedMatrixType === 'Full-Rollup Matrix' ) {
        appCtxService.registerCtx( 'matrixType', 'Full-Rollup Matrix' );
        eventBus.publish( 'requirements.getChildRollup' );
    } else if( selectedMatrixType === 'Dynamic Matrix' ) {
        appCtxService.registerCtx( 'matrixType', 'Dynamic Matrix' );
        source = self.setDynamicMatrixSourceTarget( data, ctx );

        var sourceObjectsCtx = appCtxService.getCtx( 'sourceObjects' );
        if( sourceObjectsCtx ) {
            appCtxService.updateCtx( 'sourceObjects', _getUnderlyingObjects( data.source ) );
        } else{
            appCtxService.registerCtx( 'sourceObjects', _getUnderlyingObjects( data.source ) );
        }
        selectedSourceObjects = data.source;
        appCtxService.registerCtx( 'targetObjects', [ ] );
        selectedTargetObjects = [];
        eventBus.publish( 'requirements.handleGenerateTraceabilityMatrixCommand' );
    }
    return {
        sourcePCI,
        targetPCI,
        source,
        target
    };
};

/**
 * This method creates the default object for rollup matrix soa input
 * @param {Object} ctx - context object
 * @param {Object} data - data object of view model
 * @returns {Object} inputData - default input for rollup soa
 */
export let rollupMatrixDefaultInput = function( ctx, data ) {
    var { sourcePCI, targetPCI, source, target } = self.setMatrixSourceTarget( data, ctx );
    return {
        sourceObjects: [ source ],
        targetObjects: [ target ],
        relationTypes: [ 'ALL' ],
        actionPerformed: 'TRAVERSE_CHILD',
        srcContextInfo: sourcePCI,
        targetContextInfo: targetPCI,
        itemsPerPage: 25,
        traceMatrixObject: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' },
        rowPageToNavigate: 1,
        colPageToNavigate: 1,
        showChildTracelinks: true,
        isRunInBackground: true,
        options: [ 'GENERATE_MATRIX' ]
    };
};

/**
 * This method set the source of dynamic matrix
 * @param {Object} data - data object of view model
 * @param {Object} ctx - context object
 */
self.setDynamicMatrixSourceTarget = function( data, ctx ) {
    data.source = null;
    data.target = null;
    var aa = ctx.mselected;
    var bb = [];
    for( var ii = 0; ii < aa.length; ii++ ) {
        bb.push( self.getObject( aa[ii] ) );
    }
    data.source = bb;

    return data.source;
};

/**
 * This method set the source and target objects of the traceability matrix
 * @param {Object} data - data object of view model
 * @param {Object} ctx - context object
 */
self.setMatrixSourceTarget = function( data, ctx ) {
    data.source = null;
    data.target = null;
    data.sourcePCI = null;
    data.targetPCI = null;
    if( ctx.occmgmtContext && ctx.occmgmtContext.productContextInfo ) {
        data.sourcePCI = self.getObject( ctx.occmgmtContext.productContextInfo );
        data.targetPCI = data.sourcePCI;
    }
    if( data.isShowSearch && data.symmectricMatrix.dbValue ) {
        data.source = self.getObject( ctx.mselected[ 0 ] );
        data.target = data.source;
    } else {
        data.source = self.getObject( ctx.mselected[ 0 ] );
        if( data.addPanelState && data.addPanelState.sourceObjects && data.addPanelState.sourceObjects.length > 0
            && data.addPanelState.sourceObjects[ 0 ] ) {
            data.target = self.getObject( data.addPanelState.sourceObjects[ 0 ] );
            data.targetPCI = { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' };
        } else {
            data.target = self.getObject( ctx.mselected[ 1 ] );
        }
    }
    return {
        sourcePCI: data.sourcePCI,
        targetPCI: data.targetPCI,
        source: data.source,
        target: data.target
    };
};

/**
 * This method create te default object required for traceability matrix source and target
 * @param {Object} object - source/target object
 * @returns {Object} data - object created for given input
 */
self.getObject = function( object ) {
    return {
        uid: object.uid,
        type: 'unknownType'
    };
};

export default exports = {
    handleSearchSelection,
    updateSelectedMatrixType,
    updateUIOnSelectionChange,
    validateSelection,
    generateTraceabilityMatrix,
    rollupMatrixDefaultInput
};
