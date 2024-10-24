// Copyright (c) 2022 Siemens

/**
 * @module js/Aqc0ChecklistSpecService
 */
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import messagingSvc from 'js/messagingService';
import appCtxService from 'js/appCtxService';
import _localeSvc from 'js/localeService';
import addObjectUtils from 'js/addObjectUtils';
import _ from 'lodash';
import dateTimeSvc from 'js/dateTimeService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';

var exports = {};

export let getParentChecklistSpecProperty = function( ctx ) {
    return ctx.selected !== null ? ctx.selected : {};
};

/**
  * This function will return the createInput information for creation of selected Type of object
  * @param {data} - data from view model to check the sub panel data
  * @param {ctx} - ctx object
  * @param {props} - react props to check the sub panel name
  */
export let getCreateInputDataForChecklistSpec = function( data, ctx, props, editHandler ) {
    if( !data.objCreateInfo ) {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( data.selectedType, editHandler );
    }

    var doubleProps = {};
    var boolProps = {};
    var strProps = {};
    var dateProps = {};
    var objectProps = {};

    if( data.objCreateInfo && data.objCreateInfo.props ) {
        data.objCreateInfo.props.forEach( ( vmProp ) => {
            if( vmProp.type === 'DOUBLE' && vmProp.dbValue !== null ) {
                doubleProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'BOOLEAN' && vmProp.dbValue !== null ) {
                boolProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'STRING' && vmProp.dbValue !== null ) {
                strProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
            if( vmProp.type === 'DATE' && vmProp.dbValue !== null ) {
                dateProps[ vmProp.propertyName ] = dateTimeSvc.formatUTC( vmProp.dbValue );
            }
            if( vmProp.type === 'OBJECT' && vmProp.dbValue !== null ) {
                objectProps[ vmProp.propertyName ] = vmProp.dbValue;
            }
        } );
    }

    //handle use case for adding child/sibling function element specification
    if( ctx && ctx.selected !== null && ctx.selected !== undefined ) {
        objectProps.qc0ParentChecklistSpec = ctx.selected;
    } else {
        objectProps.qc0ParentChecklistSpec = null;
    }

    if( ctx.tcSessionData.tcMajorVersion >= 14 && ctx.tcSessionData.tcMinorVersion >= 3 ) {
        //handle use case for adding child/sibling function element specification
        if( ctx && ctx.selected !== null && ctx.selected !== undefined ) {
            if( ctx.selected.props.qc0RootNode.dbValue !== ''  && ctx.selected.props.qc0RootNode.dbValues !== null && ctx.selected.props.qc0RootNode.dbValues !== undefined ) {
                var modelObject = cdm.getObject( ctx.selected.props.qc0RootNode.dbValues[0] );
                objectProps.qc0RootNode = modelObject;
            } else {
                objectProps.qc0RootNode = ctx.selected;
            }
        } else {
            objectProps.qc0RootNode = null;
        }
    }
    var inputData = {
        boName: 'Qc0ChecklistSpecification',
        stringProps: strProps,
        tagProps: objectProps,
        doubleProps: doubleProps,
        boolProps: boolProps,
        dateProps: dateProps
    };

    let input = [];

    input.push( {
        clientId: '',
        data: inputData
    } );
    return input;
};

/**
  * Drag and drop functionality for cut and paste the object in the tree view
  * @param{ModelObject} targetObject Parent to which the object is to be pasted
  * @param{ModelObject} sourceObjects object to be pasted
  */
export let setPropertiesForPaste = function( targetObject, sourceObjects ) {
    var deferred = AwPromiseService.instance.defer();
    var inputData = [];

    if ( targetObject.type === 'Qc0ChecklistSpecification' && sourceObjects.length > 0 && appCtxService.ctx.locationContext['ActiveWorkspace:SubLocation'] === 'ChecklistSpecificationSubLocation' ) {
        _.forEach( sourceObjects, function( sourceObject ) {
            if ( targetObject.type === 'Qc0ChecklistSpecification' && sourceObject.type === 'Qc0ChecklistSpecification' && targetObject.uid !== sourceObject.uid ) {
                var input = {
                    object: sourceObject,
                    timestamp: '',
                    vecNameVal: [ {
                        name: 'qc0ParentChecklistSpec',
                        values: [
                            targetObject.uid
                        ]
                    } ]
                };
                inputData.push( input );
            }
        } );
        soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', {
            info: inputData
        } ).then(
            function() {
                deferred.resolve();
                if ( appCtxService.ctx.pselected !== undefined ) {
                    eventBus.publish( 'cdm.relatedModified', {
                        relatedModified: [ appCtxService.ctx.pselected, targetObject ]
                    } );
                } else {
                    eventBus.publish( 'primaryWorkarea.reset' );
                }
            },
            function( error ) {
                var errMessage = messagingSvc.getSOAErrorMessage( error );
                messagingSvc.showError( errMessage );
                deferred.reject( error );
                eventBus.publish( 'cdm.relatedModified', {
                    relatedModified: [ appCtxService.ctx.pselected, targetObject ]
                } );
            }
        );
    } else {
        var resource = 'qualityfailuremanagerMessages';
        var localTextBundle = _localeSvc.getLoadedText( resource );
        var errorMessage = localTextBundle.Aqc0DragDropError;
        messagingSvc.showError( errorMessage );
    }
    return deferred.promise;
};

/**
 * Update add panel state with the selected object in data provider
 * @param {context} context
 * @param {object} addPanelState
 */
export const handleSearchSelection = function( context, subPanelContext, addPanelState ) {
    let sourceObjects = context.selectedObjects;

    let newSubPanelContext = { ...subPanelContext };
    //update atomic data
    if ( addPanelState ) {
        let newAddPanelState = { ...addPanelState.value };
        if ( sourceObjects.length > 0 ) {
            newAddPanelState.sourceObjects = sourceObjects;
        } else {
            newAddPanelState.sourceObjects = null;
        }
        addPanelState.update( newAddPanelState );
    }
    return {
        sourceObjects: sourceObjects
    };
};

/**
 * get Search Criteria for input to performSearchViewModel5 SOA
 *
 * @param {DeclViewModel} data - Aqc0AddRatingRuleViewModel
 * @param {int} startIndex - current index of the searchFolders dataProvider
 * @param {ctx} ctx - current context
 */
export let getSearchCriteria = function( data, startIndex, ctx ) {
    var searchCriteria = {};
    searchCriteria.typeOfSearch = 'ADVANCED_SEARCH';
    searchCriteria.utcOffset = '0';

    if( ctx.search && startIndex > 0 ) {
        searchCriteria.totalObjectsFoundReportedToClient = ctx.search.totalFound.toString();
        searchCriteria.lastEndIndex = ctx.search.lastEndIndex.toString();
    } else {
        searchCriteria.totalObjectsFoundReportedToClient = '0';
        searchCriteria.lastEndIndex = '0';
    }
    searchCriteria.queryName = '_AQC_GetRatingRuleObjects';

    let filterString = getFilterBoxValueWithWildCard( data.filterBox.dbValue );
    searchCriteria.Name = filterString;
    searchCriteria.object_name = filterString;
    return searchCriteria;
};

/**
 * get Filterstring value with wild card character
 */
var getFilterBoxValueWithWildCard = function( filterString ) {
    if( filterString === '' ) {
        filterString = '*';
    } else if( !filterString.includes( '*' ) ) {
        filterString = '*' + filterString + '*';
    }

    return filterString;
};

/**
 * This API is added to process the Partial error being thrown from the SOA
 *
 * @param {object} response - the response of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorString = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if ( response && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

/**
 * This API is added to form the message string from the Partial error being thrown from the SOA
 */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * This API is added to get the 'setProperties' info object for selected rating rule
 *
 * @param {DeclViewModel} data - Aqc0AddRatingRuleViewModel
 * @param {Object} subPanelContext - sub panel context
 * @return {Object} info - Info object
 */
export const getSetPropertiesInfoForRatingRule = function( createdOrSearchedObject, subPanelContext ) {
    var info = [];
    var values = [];

    if( createdOrSearchedObject ) {
        values.push( createdOrSearchedObject.uid );
    }
    if( values.length > 0 ) {
        var propOne = {
            name: 'qc0RatingRuleReference',
            values: values
        };

        var vecNameVal = [];
        vecNameVal.push( propOne );

        var checklistSpecObject = {
            object: subPanelContext.selectionData.selected[0],
            timestamp: '',
            vecNameVal: vecNameVal
        };

        info.push( checklistSpecObject );
    }
    return info;
};

/**
 * This API is added to get the 'CreateObjects' input object for rating rule
 *
 * @param {DeclViewModel} data - Aqc0AddRatingRuleViewModel
 * @param {Object} subPanelContext - subPanelContext object
 * @return {Object} info - Info object
 */
export const getCreateObjectsInputforRatingRule = function( data, subPanelContext ) {
    var inputData = [];
    var boType;
    var strProps = {};
    if ( !data.objCreateInfo ) {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( subPanelContext.selectedType, subPanelContext.editHandler );
    }

    boType = data.objCreateInfo.createType;

    if ( data.objCreateInfo && data.objCreateInfo.props ) {
        data.objCreateInfo.props.forEach( ( vmProp ) => {
            if ( vmProp.type === 'STRING' && vmProp.dbValue !== null ) {
                strProps[vmProp.propertyName] = vmProp.dbValue;
            }
        } );
    }

    if ( data.objCreateInfo.props.length > 0 ) {
        var dataVal = {
            boName: boType,
            stringProps: strProps
        };

        var input = {
            clientId: '',
            data: dataVal
        };
        inputData.push( input );
    }

    return inputData;
};

/**
 * This API is added to update the trigger property
 *
 * @param {prop} triggerCrate - A property to update
 * @param {bool} value - boolean value to set
 */
export const updateCreateTrigger = function( triggerCreate, value ) {
    let newTriggerCreate = { ...triggerCreate };
    newTriggerCreate.dbValue = value;

    return { triggerCreate: newTriggerCreate };
};

/**
 * Load rating rule object attached to Checklist specification object
 * @param {ctx} ctx Current context
 */
export let loadRatingRuleObjectWithProps = function( ctx ) {
    let deferred = AwPromiseService.instance.defer();

    var selectedObject;
    if( ctx.selected.type === 'Qc0ChecklistSpecification' ) {
        selectedObject = ctx.selected;
    } else {
        selectedObject = ctx.pselected;
    }

    let ratingReferenceProp = selectedObject.props.qc0RatingRuleReference;
    let ratingObjectUID = ratingReferenceProp ? ratingReferenceProp.dbValues[0] : ratingReferenceProp;

    if ( ratingObjectUID ) {
        var ratingObject = cdm.getObject( ratingObjectUID );
        let propsArray = [];

        if( !ratingObject.props.qc0AssessmentRule ) {
            propsArray.push( 'qc0AssessmentRule' );
        }
        if ( !ratingObject.props.qc0AnswerOptions ) {
            propsArray.push( 'qc0AnswerOptions' );
        }
        if( !ratingObject.props.qc0AnswerOptionValues ) {
            propsArray.push( 'qc0AnswerOptionValues' );
        }

        if ( propsArray.length > 0 ) {
            dms.getProperties( [ ratingObjectUID ], propsArray ).then(
                function() {
                    ratingObject = cdm.getObject( ratingObjectUID );
                    deferred.resolve( {
                        ratingObject: ratingObject
                    } );
                }
            );
        } else {
            deferred.resolve( {
                ratingObject: ratingObject
            } );
        }
    } else {
        deferred.resolve( {
            ratingObject: null
        } );
    }

    return deferred.promise;
};

/**
  * Load LOV in data for panel.
  * @param {response} response - The response of the SOA call.
  * @param {boolean} addEmpty1stItem - true if add empty item to head of list
  * @returns {Object} value the LOV value
  */
export let getLOVlist = function( response, addEmpty1stItem ) {
    const value = createLOVObject( response );
    const addEmpty1stItemBoolean = addEmpty1stItem === 'true';
    var values = [];

    if ( addEmpty1stItemBoolean ) {
        var emptyListModel = getEmptyListModel();
        values.push( emptyListModel );
    }

    for ( let index = 0; index < value.length; index++ ) {
        values.push( value[index] );
    }

    return values;
};


/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
*/
var getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: true
    };
};

/**
 * Map lov values of response to
 * @param {response} response
 */
var createLOVObject = function( response ) {
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[0],
            propDisplayDescription: obj.propDisplayValues.lov_value_descriptions ? obj.propDisplayValues.lov_value_descriptions[0] : obj.propDisplayValues.lov_values[0],
            propInternalValue: obj.propInternalValues.lov_values[0]
        };
    } );
};

export default exports = {
    getCreateInputDataForChecklistSpec,
    getParentChecklistSpecProperty,
    setPropertiesForPaste,
    getSearchCriteria,
    handleSearchSelection,
    populateErrorString,
    getSetPropertiesInfoForRatingRule,
    getCreateObjectsInputforRatingRule,
    updateCreateTrigger,
    loadRatingRuleObjectWithProps,
    getLOVlist,
    createLOVObject
};
