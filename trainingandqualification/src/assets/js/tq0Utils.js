// Copyright (c) 2022 Siemens

/**
 * @module js/tq0Utils
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import listBoxService from 'js/listBoxService';
import parsingUtils from 'js/parsingUtils';
import eventBus from 'js/eventBus';
import navigationSvc from 'js/navigationService';
import _ from 'lodash';
import editHandlerService from 'js/editHandlerService';
import dateTimeSvc from 'js/dateTimeService';
import _uwPropertySvc from 'js/uwPropertyService';
import messagingService from 'js/messagingService';
import cdm from 'soa/kernel/clientDataModel';

/**
 * Define public API
 */
var exports = {};

var saveEditHandler = {};

var getInitialLOVValueDeferred;

/**
 * Create the input stricture that will be pass to server to get the
 * group member from user obejct.
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Array} selection - The selection object array
 *
 * @return {Object} - userInput object that holds the correct values .
 */
var getInputData = function( data, selection ) {
    var userInput = {};
    var input = {};

    // Check if selection is not null and 0th index object is also not null
    // then only add it to the view model
    if ( data && selection && selection.length > 0 ) {
        var userId = selection[0].props.user_id.dbValues[0];
        var groupName;
        var roleName;

        if ( data.additionalSearchCriteria ) {
            if ( data.additionalSearchCriteria.group && data.additionalSearchCriteria.role ) {
                groupName = data.additionalSearchCriteria.group;
                roleName = data.additionalSearchCriteria.role;
            } else if ( !data.additionalSearchCriteria.group && data.additionalSearchCriteria.role ) {
                groupName = '*';
                roleName = data.additionalSearchCriteria.role;
            } else if ( data.additionalSearchCriteria.group && !data.additionalSearchCriteria.role ) {
                groupName = data.additionalSearchCriteria.group;
                roleName = '*';
            } else {
                groupName = selection[0].props.default_group.uiValue;
            }
        } else {
            groupName = selection[0].props.default_group.uiValue;
        }

        // Check if object is selected then only create the input structure
        if ( selection[0].selected ) {
            input = {
                userID: userId,
                userName: userId,
                groupName: groupName,
                roleName: roleName,
                includeInactive: false,
                includeSubGroups: true
            };
        }
    }
    userInput.input = input;
    return userInput;
};

/**
 * Get the valid selected obejct from input selected objects. If input selection
 * has user obejct then it will get group memebr from user otherwise directly return input.
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Array} selection - The selection object array
 *
 * @return {Object} - userInput object that holds the correct values .
 */
export let getValidObjectsToAdd = function( data, selection ) {
    var deferred = AwPromiseService.instance.defer();
    if ( selection[0] && selection[0].type && selection[0].type === 'User' ) {
        var input = getInputData( data, selection );
        var policyId = policySvc.register( {
            types: [ {
                name: 'User',
                properties: [ {
                    name: 'user_id',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                } ]
            },
            {
                name: 'GroupMember',
                properties: [ {
                    name: 'default_role'
                } ]
            }
            ]
        } );
        soaService.postUnchecked( 'Internal-Administration-2012-10-OrganizationManagement',
            'getOrganizationGroupMembers', input ).then(
            function( response ) {
                if ( policyId ) {
                    policySvc.unregister( policyId );
                }
                var gmObject = null;
                if ( response && response.groupElementMap && response.groupElementMap[1]['0'] ) {
                    //check for default_role property on returned groupmembers
                    var groupMembers = response.groupElementMap[1]['0'].members;
                    var foundDefaultRole = false;

                    for ( var i = 0; i < groupMembers.length; i++ ) {
                        var propValue = groupMembers[i].members[0].props.default_role;
                        if ( propValue.dbValues[0] === '1' ) {
                            gmObject = groupMembers[i].members[0];
                            foundDefaultRole = true;
                            break;
                        }
                    }
                    if ( !foundDefaultRole ) {
                        gmObject = response.groupElementMap[1]['0'].members['0'].members['0'];
                    }
                }

                // If valid group member is not found then return empty array from here
                if ( !gmObject ) {
                    return deferred.resolve( [] );
                }

                // Add cellHeaders to GM
                var gmVMObject = viewModelObjectService.createViewModelObject( gmObject );
                gmVMObject.selected = true;
                gmVMObject.cellHeader1 = selection[0].cellHeader1;
                var groupMemberObjects = [];
                groupMemberObjects.push( gmVMObject );
                return deferred.resolve( groupMemberObjects );
            } );
    } else {
        deferred.resolve( selection );
    }
    return deferred.promise;
};

/**
 * This operation is invoked to query the data for a property having an LOV attachment. The results returned
 * from the server also take into consideration any filter string that is in the input. This method calls
 * 'getInitialLOVValues' and returns initial set of lov values.
 *
 * @param {filterString} data - The filter text for lov's
 * @param {deferred} deferred - $q object to resolve the 'promise' with a an array of LOVEntry objects.
 * @param {ViewModelProperty} prop - Property to aceess LOV values for.
 * @param {String} filterContent Filter content string
 * @param {String} defaultString To be populate on group or role LOV
 * @param {String} filterStr Filter string
 */
var getInitialLOVValues = function( data, deferred, prop, filterContent, defaultString, filterStr ) {
    if ( !getInitialLOVValueDeferred ) {
        getInitialLOVValueDeferred = deferred;

        var lovValues = [];
        exports.performRoleSearchByGroup( prop, 0, filterContent, filterStr ).then( function( validObjects ) {
            if ( validObjects ) {
                lovValues = listBoxService.createListModelObjectsFromStrings( [ defaultString ] );
                // Create the list model object that will be displayed
                Array.prototype.push.apply( lovValues, validObjects );
            }
            deferred.resolve( lovValues );
            getInitialLOVValueDeferred = null;
        }, function( reason ) {
            deferred.reject( reason );
            getInitialLOVValueDeferred = null;
        } );
    }
};

/**
 * Generate the next LOV values when user is doing pagination in LOV.
 * @param {deferred} deferred - $q object to resolve the 'promise' with a an array of LOVEntry objects.
 * @param {Object} prop Property object
 * @param {String} filterContent Filter content string
 * @returns {deferred} promise
 */
var getNextLOVValues = function( deferred, prop, filterContent ) {
    var lovEntries = [];

    // Check if more values exist then only call SOA.
    if ( prop.moreValuesExist ) {
        var startIdx = prop.endIndex;
        exports.performRoleSearchByGroup( prop, startIdx, filterContent, null ).then( function( validObjects ) {
            lovEntries = validObjects;
            deferred.resolve( lovEntries );
        } );
    } else {
        deferred.resolve( lovEntries );
    }
    return deferred.promise;
};

/**
 * Populate the group LOV values.
 *
 * @param {Object} data Data view model object
 * @param {Object} prop Property object
 */
export let populateGroupLOV = function( data, prop ) {
    var parentData = data;
    prop.lovApi = {};

    prop.contentType = 'Group';

    // This is needed to remove the first empty entry fromn LOV values
    prop.emptyLOVEntry = false;
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        getInitialLOVValues( data, deferred, prop, data.roleName, data.i18n.allGroups, filterStr );
    };

    prop.lovApi.getNextValues = function( deferred ) {
        getNextLOVValues( deferred, prop, data.roleName );
    };

    prop.lovApi.validateLOVValueSelections = function( lovEntries ) {
        parentData.groupName = null;
        if ( lovEntries[0].propInternalValue.uid ) {
            parentData.groupName = lovEntries[0].propInternalValue.props.object_full_name.dbValues[0];
        } else if ( lovEntries[0].propInternalValue !== data.i18n.allGroups ) {
            // This is needed when user entered some wrong value which is not present
            // then set to default all groups
            prop.dbValue = data.i18n.allGroups;
            prop.uiValue = data.i18n.allGroups;
        }
        if ( parentData.additionalSearchCriteria ) {
            parentData.additionalSearchCriteria.group = parentData.groupName;
        }
        eventBus.publish( 'awPopupWidget.close', {
            propObject: prop
        } );
    };
};

/**
 * Populate the role LOV values.
 *
 * @param {Object} data Data view model object
 * @param {Object} prop Property object
 */
export let populateRoleLOV = function( data, prop ) {
    var parentData = data;
    prop.contentType = 'Role';
    prop.lovApi = {};

    // Check if searchSubGroup present on data that means we need
    // to search role inside sub group
    if ( data.searchSubGroup ) {
        prop.searchSubGroup = true;
    }

    // This is needed to remove the first empty entry fromn LOV values
    prop.emptyLOVEntry = false;
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        getInitialLOVValues( data, deferred, prop, data.groupName, data.i18n.allRoles, filterStr );
    };

    prop.lovApi.getNextValues = function( deferred ) {
        getNextLOVValues( deferred, prop, data.groupName );
    };

    prop.lovApi.validateLOVValueSelections = function( lovEntries ) {
        parentData.roleName = null;
        if ( lovEntries[0].propInternalValue.uid ) {
            parentData.roleName = lovEntries[0].propInternalValue.props.role_name.dbValues[0];
        } else if ( lovEntries[0].propInternalValue !== data.i18n.allRoles ) {
            // This is needed when user entered some wrong value which is not present
            // then set to default all roles
            prop.dbValue = data.i18n.allRoles;
            prop.uiValue = data.i18n.allRoles;
        }
        if ( parentData.additionalSearchCriteria ) {
            parentData.additionalSearchCriteria.role = parentData.roleName;
        }
        eventBus.publish( 'awPopupWidget.close', {
            propObject: prop
        } );
    };
};

/**
 * This method will create the required input that needs to be passed to assignQualificationUnits SOA in the below format.
 *
 * assignQualificationInputs:[{
        qualificationUnits: "IModelObject[]",
        qualificationProfiles: "IModelObject[]"
   }]
 * @param {Object} selectedObjs object containing the selected QUs from assign QUs panel in UI
 * @param {Object} selectedQProfiles object containing the list of QPs to witch the user wants to attach QU(s)
 *
 * @returns {Object} contains an array of objects that are input to assignQualificationUnits SOA
 */
export let getAssignQUsSoaInp = function( selectedObjs, mSelectedQProfiles, pSelectedQProfiles, ctx ) {
    var soaInputToPass = [];
    var assignQUInpts = {};
    var qUnits = [];
    var qProfiles = [];

    var genericQProfileArray = [];
    if ( ctx && ctx.mselected && ctx.mselected[0].modelType.typeHierarchyArray.indexOf( 'Tq0QualProfileGroup' ) > -1 ) {
        genericQProfileArray = ctx.selected.props.tq0QualProfileList.dbValues;
    } else if ( ctx && ctx.pselected && ctx.pselected.modelType.typeHierarchyArray.indexOf( 'Tq0QualProfileGroup' ) > -1) {
        genericQProfileArray = ctx.pselected.props.tq0QualProfileList.dbValues;
    } else if ( pSelectedQProfiles && pSelectedQProfiles.modelType.typeHierarchyArray.indexOf( 'Tq0QualificationProfile') > -1 ) {
        genericQProfileArray.push( pSelectedQProfiles );
    } else {
        genericQProfileArray = mSelectedQProfiles;
    }

    //this loop will add uids of all the selected objects from UI to the input for SOA
    for ( var i = 0; i < selectedObjs.length; i++ ) {
        var jsonInputQU = {};
        jsonInputQU.type = selectedObjs[i].type;
        jsonInputQU.uid = selectedObjs[i].uid;
        qUnits.push( jsonInputQU );
    }

    //this loop will make sure all the QPs are added to the input for SOA
    for ( i = 0; i < genericQProfileArray.length; i++ ) {
        var jsonInputQP = {};
        if ( ctx && ctx.mselected && ctx.pselected && ( ctx.mselected[0].modelType.typeHierarchyArray.indexOf( 'Tq0QualProfileGroup' ) > -1
                                                        || ctx.pselected.modelType.typeHierarchyArray.indexOf( 'Tq0QualProfileGroup' ) > -1 ) ) {
            jsonInputQP.type = 'Tq0QualificationProfile';
            jsonInputQP.uid = genericQProfileArray[i];
        } else {
            jsonInputQP.type = genericQProfileArray[i].type;
            jsonInputQP.uid = genericQProfileArray[i].uid;
        }

        // Don't add Qual Profile to SOA input if target entity is not added to it
        var profileObj = cdm.getObject(jsonInputQP.uid);
        if( profileObj.props.tq0TargetEntity.dbValues[0] === null ) {
            continue;
        }

        qProfiles.push( jsonInputQP ); 
    }
    //add values to qualificationUnits
    assignQUInpts.qualificationUnits = qUnits;
    //add values to qualificationProfiles
    assignQUInpts.qualificationProfiles = qProfiles;
    //push the values to input
    soaInputToPass.push( assignQUInpts );

    return soaInputToPass;
};

/**
 * This method will create the required input structure needed for Tq0QUnitContent relation property that needs to be passed to SOA in the below format.
 *
 *  tq0QUnitContent : "IModelObject[]"
 *
 * @param {Object} selectedObjs object containing the selected QUs from assign QUs panel in UI
 *
 * @returns {Array} contains an array of model objects that are input to tq0QUnitContent property
 */
export let getVersionQUsSoaInp = function( selectedObjs ) {
    var soaInputToPass = [];
    var qUnitContents = [];
    qUnitContents = selectedObjs.props.Tq0QUnitContent.dbValue;
    var qUnitContentsObjs = [];

    //this loop will add uids of all the selected objects from UI to the input for SOA
    for ( var i = 0; i < qUnitContents.length; i++ ) {
        var jsonInputQU = {};
        jsonInputQU = viewModelObjectService.createViewModelObject( qUnitContents[i] );
        qUnitContentsObjs.push( jsonInputQU );
    }

    return qUnitContentsObjs;
};

/**
 * This method will create the required input structure needed for tq0Prerequisites property that needs to be passed to SOA in the below format.
 *
 *  tq0Prerequisites : "IModelObject[]"
 *
 * @param {Object} selectedObjs object containing the selected QUs from assign QUs panel in UI
 *
 * @returns {Array} contains an array of model objects that are input to tq0Prerequisites property
 */
export let getVersionQUsSoaInputForPrereq = function( selectedObjs ) {
    var prerequisites = [];
    prerequisites = selectedObjs.props.tq0Prerequisites.dbValues;
    var prerequisitesObjs = [];

    //this loop will add uids of all the selected objects from UI to the input for SOA
    for ( var i = 0; i < prerequisites.length; i++ ) {
        var jsonInputQU = {};
        jsonInputQU = viewModelObjectService.createViewModelObject( prerequisites[i] );
        prerequisitesObjs.push( jsonInputQU );
    }

    return prerequisitesObjs;
};

/**
 * This method will create the required input structure needed for tq0QualUnitList property that needs to be passed to SOA in the below format.
 *
 *  tq0QualUnitList : "IModelObject[]"
 *
 * @param {Object} selectedObjs object containing the selected QUs from assign QUs panel in UI
 *
 * @returns {Array} contains an array of model objects that are input to tq0QualUnitList property
 */
export let getVersionQDSoaInput = function( selectedObjs ) {
    var QDefList = [];
    QDefList = selectedObjs.props.tq0QualUnitList.dbValues;
    var QDefListObjs = [];

    //this loop will add uids of all the selected objects from UI to the input for SOA
    for ( var qui = 0; qui < QDefList.length; qui++ ) {
        var jsonInputQDef = {};
        jsonInputQDef = viewModelObjectService.createViewModelObject( QDefList[qui] );
        QDefListObjs.push( jsonInputQDef );
    }

    return QDefListObjs;
};

/**
 * Execute all post event or actions afeter Char spec version
 * @param {Object} createdObject - created Object
 * @param {Object} subPanelContext - sub Panel Context
 */
export let executePostVersionEventActionsForQU = function( createdObject, subPanelContext ) {
    var commandContext = {
        vmo: createdObject
    };
    var navigationParams = {
        uid: commandContext.vmo.uid,
        edit: 'true'
    };
    var action = {
        actionType: 'Navigate',
        navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
    };
    navigationSvc.navigate( action, navigationParams );
};

/**
 * Execute all post event or actions afeter Char spec version
 * @param {Object} createdObject - created Object
 * @param {Object} subPanelContext - sub Panel Context
 */
export let executePostVersionEventActionsForQD = function( createdObject, subPanelContext ) {
    var commandContext = {
        vmo: createdObject
    };
    var navigationParams = {
        uid: commandContext.vmo.uid,
        edit: 'true'
    };
    var action = {
        actionType: 'Navigate',
        navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
    };
    navigationSvc.navigate( action, navigationParams );
};

/**
 * Get the group or role content based on input values and created LOV entries and return.
 *
 * @param {Object} prop Property obejct whose properties needs to be populated
 * @param {int} startIndex Start index value
 * @param {Object} filterContent Filter content object that can be filter group or role
 * @param {Object} filterStr Filter string to filter group or role. This is when user is tryong on LOV
 *
 * @returns {Promise} Promise object
 */
export let performRoleSearchByGroup = function( prop, startIndex, filterContent, filterStr ) {
    var deferred = AwPromiseService.instance.defer();
    var contentType = prop.contentType;
    var searchCriteria = {
        resourceProviderContentType: contentType
    };

    if ( contentType === 'Group' && filterContent ) {
        searchCriteria.role = filterContent;
    } else if ( contentType === 'Role' && filterContent ) {
        searchCriteria.group = filterContent;
    }

    if ( filterStr ) {
        searchCriteria.searchString = filterStr;
    }

    // Check if sub group need to be search. Pass that value to server
    if ( prop.searchSubGroup ) {
        searchCriteria.searchSubGroup = 'true';
    }

    // By default resource provider will be Awp0ResourceProvider if other resource provider exist in
    // ctx then it will use that
    var resourceProvider = 'Awp0ResourceProvider';
    if ( appCtxSvc.ctx.workflow && appCtxSvc.ctx.workflow.resourceProvider ) {
        resourceProvider = appCtxSvc.ctx.workflow.resourceProvider;
    }

    var inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        inflateProperties: false,
        saveColumnConfigData: {},
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: resourceProvider,
            searchCriteria: searchCriteria,
            cursor: {
                startIndex: startIndex,
                endReached: false,
                startReached: false,
                endIndex: 0
            },
            searchSortCriteria: [],
            searchFilterFieldSortType: 'Alphabetical'
        }
    };

    // SOA call made to get the content
    soaService.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData ).then( function( response ) {
        var lovEntries = [];
        var modelObjects = [];

        if ( response.searchResultsJSON ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            if ( searchResults ) {
                for ( var i = 0; i < searchResults.objects.length; i++ ) {
                    var uid = searchResults.objects[i].uid;
                    var obj = response.ServiceData.modelObjects[uid];
                    modelObjects.push( obj );
                }
            }
            if ( modelObjects ) {
                // Create the list model object that will be displayed
                var groups = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
                Array.prototype.push.apply( lovEntries, groups );
            }
        }

        // Populate the end index and more values present or not
        var endIndex = response.cursor.endIndex;
        var moreValuesExist = !response.cursor.endReached;
        if ( endIndex > 0 && moreValuesExist ) {
            endIndex += 1;
        }
        prop.endIndex = endIndex;
        prop.moreValuesExist = moreValuesExist;
        deferred.resolve( lovEntries );
    } );

    return deferred.promise;
};

/**
 * @param {Object} dataProvider - dataProvider
 * @returns {Array} prerequisites to add/remove
 */
export let getPrerequisiteValues = function( dataProvider ) {
    let existingPrerequisites = [];
    let ctx = appCtxSvc.getCtx();
    dataProvider === undefined ?  existingPrerequisites = ctx.pselected.props.tq0Prerequisites.dbValues : existingPrerequisites = ctx.selected.props.tq0Prerequisites.dbValues;
    if( dataProvider ) {
        _.forEach( dataProvider.viewModelCollection.loadedVMObjects, function( object ) {
            if( object.selected === true ) {
                existingPrerequisites.push( object.uid );
            }
        } );
    }else{
        _.forEach( ctx.mselected, function( object ) {
            _.pull( existingPrerequisites, object.uid );
        } );
    }

    return existingPrerequisites;
};

/** This function creates the input for TcSoaService  calls it.
 *Which will add the qualification units to the qualification definition object
 */ 
 export let getQualUnitList = function (selectedObjects) {
    let existingQU = [];
    let ctx = appCtxSvc.getCtx();

    existingQU = ctx.selected.props.tq0QualUnitList.dbValues;
    _.forEach(selectedObjects, function (object) {
        existingQU.push(object.uid);
    });

    var inputData = [];
    var selectedQD = ctx.mselected;
    
    var infoObj = {};
    infoObj.object = { type: selectedQD[0].type, uid: selectedQD[0].uid };
    infoObj.timestamp = '';

    var prop = {};
    prop.name = 'tq0QualUnitList';
    prop.values = existingQU;

    var vecNameVal = [];
    vecNameVal.push(prop);

    infoObj.vecNameVal = vecNameVal;
    inputData.push(infoObj);

    return inputData;
};

// /**
//  * Method to reset selections in SPLM table
//  */
export let DeletionSuccess = function() {
    appCtxSvc.updateCtx( 'selectionArr', '' );
    eventBus.publish( 'tq0QualificationsTabQuAssigned' );
};

/**
 * Below function creates input skeleton for calling performSearchViewModel5 SOA
 *  @param {object} - selectedObject - Selected Object from the list
 *  @param {object} - filterValue - value entered by user inside input field
 *  @return {object} -  input skeleton for performSearchViewModel5 SOA
 */
let getInputForSOA = function( objectTypeToBeSearched, selectedObject, filterValue ) {
    var searchCriteriaObj = {
        Name: '*' + filterValue.dbValue + '*',
        Type: objectTypeToBeSearched,
        ReleaseStatus: 'TCM Released',
        lastEndIndex: '',
        totalObjectsFoundReportedToClient: '',
        typeOfSearch: 'ADVANCED_SEARCH',
        utcOffset: '0'
    };
    if( appCtxSvc.ctx.selected.type === 'Tq0QualificationUnit' ) {
        searchCriteriaObj.Prerequisites = 'true';
        searchCriteriaObj.parentUid = selectedObject.uid;
    }
    if( appCtxSvc.ctx.selected.type === 'Tq0QualificationDefinition' ) {
        searchCriteriaObj.parentUid = selectedObject.uid;
    }
    return {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        inflateProperties: false,
        saveColumnConfigData: {},
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Tq0LatestReleasedQUProvider',
            searchCriteria: searchCriteriaObj,
            searchFilterFieldSortType: 'Priority'
        }
    };
};


/**
 * Below function calls performSearchViewModel5 SOA and returns the promise
 *  @param {object} - soaInput - input for performSearchViewModel5 SOA
 *  @returns {promise} - promise - resolved promise
 */
let callPerformSearchSOA = function( soaInput ) {
    var deferred = AwPromiseService.instance.defer();

    // SOA call made to get Released Qualification Units
    soaService.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then( function( response ) {
        if ( response.totalFound > 0 ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            if ( searchResults ) {
                var newElements = response.ServiceData.plain.map( function( uid ) {
                    return response.ServiceData.modelObjects[ uid ];
                } );
                deferred.resolve( {
                    searchResults: newElements,
                    totalFound: searchResults.length
                } );
            }
        }else{
            deferred.resolve( {} );
        }
    } );
    return deferred.promise;
};

/** This function creates the input for performSearchViewModel5 SOA and calls it.
 * @param {Object} - Selected Object from the panel
 * @param {filterValue} - String Entered in the filterbox of panel
 * @returns {Object} - Returns the Qualification Units if found
*/
export let searchQualificationUnit = function( selectedObject, filterValue ) {
    let objectTypeToBeSearched = 'Tq0QualificationUnit';
    let soaInput = getInputForSOA( objectTypeToBeSearched, selectedObject, filterValue );
    soaInput.searchInput.searchCriteria.isQualDefinition = 'false';

    return callPerformSearchSOA( soaInput );
};

/** This function validates tq0targetEntity property for the selected profile.
 * @param {Object} - mselected Objects from the panel
 * @returns {boolean} - Returns the true if found target entity assigned to each profile.
*/
export let checkTargetEntityAddedOrNot = function( mselected ) {

    let profileData = {}; 
    profileData.hasTargetEntity = true;

    _.each( mselected, function( obj ){
        // check target entity for Qualification Profile Group
        if( obj.modelType.typeHierarchyArray.indexOf( 'Tq0QualProfileGroup' ) > -1 ) {
            var genericQProfileArray = [];

            genericQProfileArray = obj.props.tq0QualProfileList.dbValues;
            for ( var i = 0; i < genericQProfileArray.length; i++ ) { 
                var profileObj = cdm.getObject(genericQProfileArray[i]);
                if( profileObj.props.tq0TargetEntity.dbValues[0] === null ){
                    profileData.hasTargetEntity = false;
                    return profileData;
                }
            }
        }
        
        // check target entity for Qualification Profile
        if( obj.modelType.typeHierarchyArray.indexOf( 'Tq0QualificationProfile' ) > -1 ){
            if( obj.props.tq0TargetEntity.dbValue === null ){
                profileData.hasTargetEntity = false;
                return profileData;
            }
        }
    });
    
    return profileData;
};

/** This function creates the input for performSearchViewModel5 SOA and calls it.
 * @param {Object} - Selected Object from the panel
 * @param {filterValue} - String Entered in the filterbox of panel
 * @returns {Object} - Returns the Qualification Definitions if found
*/
export let searchQualificationDefinitions = function( selectedObject, filterValue ) {
    let objectTypeToBeSearched = 'Tq0QualificationDefinition';
    let soaInput = getInputForSOA( objectTypeToBeSearched, selectedObject, filterValue );
    soaInput.searchInput.searchCriteria.isQualDefinition = 'true';
    return callPerformSearchSOA( soaInput );
};


/**
 * On radio buttin change nullify the other property as only one of them can be present on object at a given time
 *  @param {data} data object
 */
export let changeRadioForDelayedRelease = function( data ) {
    if( data.whenApproved.dbValue === 'tq0DelayByDays' ) {
        data.dateDetails.dbValue = null;
        data.dateDetails.displayValues[0] = null;
        data.dateDetails.uiValue = null;
    }else if( data.whenApproved.dbValue === 'tq0DelayByDate' ) {
        data.delayByDaysTextBox.dbValue = null;
        data.delayByDaysTextBox.displayValues[0] = null;
        data.delayByDaysTextBox.uiValue = null;
    }
};

/**
 * Returns dirty bit.
 * @param {dataSource} dataSource of selected object
 * @returns {Boolean} isDirty bit
 */
saveEditHandler.isDirty = function( dataSource ) {
    var modifiedPropCount = dataSource.getAllModifiedProperties().length;
    if ( modifiedPropCount === 0 ) {
        return false;
    }
    return true;
};

/**
 * This function sets the propeties of custom panel in edit mode
 * @param {data} data
 */

export let editStateChangeForRenewalSchedule = function( data ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    if ( activeEditHandler && activeEditHandler.editInProgress() ) {
        _uwPropertySvc.setIsEditable( data.delayByDaysTextBox, activeEditHandler.editInProgress() );
        _uwPropertySvc.setDirty( data.delayByDaysTextBox, true );

        _uwPropertySvc.setIsEditable( data.dateDetails, activeEditHandler.editInProgress() );
        _uwPropertySvc.setDirty( data.dateDetails, true );

        _uwPropertySvc.setIsEditable( data.AllowEarlyRelease, activeEditHandler.editInProgress() );
        _uwPropertySvc.setDirty( data.AllowEarlyRelease, true );

        _uwPropertySvc.setIsEditable( data.updateQualRecords, activeEditHandler.editInProgress() );
        _uwPropertySvc.setDirty( data.updateQualRecords, true );
    }
    if( activeEditHandler && !activeEditHandler.editInProgress() ) {
        let soaInput = getSaveEditInput( data );
        callSaveEditSoa( soaInput );
    }
};


let getSaveEditInput = function( data ) {
    let objectToReturn = {};
    let inputData = [];
    let tq0DelayByDateVal = null;
    let tq0DelayByDaysVal = null;
    let tq0WhenApproved = true;

    if( data.whenApproved.dbValue === 'tq0WhenApproved' ) {
        tq0DelayByDateVal = null;
        tq0DelayByDaysVal = null;
        tq0WhenApproved = true;
        data.whenApproved.uiValue  = null;
        data.releaseScheduleLabel.uiValue = 'When Approved';
    }else if( data.whenApproved.dbValue === 'tq0DelayByDays' ) {
        tq0DelayByDaysVal = data.delayByDaysTextBox.dbValue;
        tq0DelayByDateVal = null;
        tq0WhenApproved = false;
        data.whenApproved.uiValue  = null;
        data.releaseScheduleLabel.uiValue = 'Delay by Days';
        data.delayByDaysTextBoxValue.uiValue = data.delayByDaysTextBox.dbValue;
    }else{
        tq0DelayByDateVal = dateTimeSvc.formatUTC( data.dateDetails.dbValue );
        tq0DelayByDaysVal = null;
        tq0WhenApproved = false;
        data.whenApproved.uiValue  = null;
        data.releaseScheduleLabel.uiValue = 'Delay by Date';
    }

    var input = {
        object: appCtxSvc.ctx.selected,
        timestamp: '',
        vecNameVal: [
            {
                name: 'tq0AllowEarlyRelease',
                values: [
                    String( data.AllowEarlyRelease.dbValue )
                ]
            },
            {
                name: 'tq0ImmediateRelease',
                values: [
                    String( tq0WhenApproved )
                ]
            },
            {
                name: 'tq0ReleaseAfterDate',
                values: tq0DelayByDateVal !== null ? [ tq0DelayByDateVal ] : null
            },
            {
                name: 'tq0ReleaseAfterDays',
                values: tq0DelayByDaysVal !== null ? [ tq0DelayByDaysVal ] : null
            },
            {
                name: 'tq0RequalificationRequired',
                values: [
                    String( data.updateQualRecords.dbValue )  === '' ? 'False' : String( data.updateQualRecords.dbValue )
                ]
            }
        ]
    };
    inputData.push( input );
    objectToReturn.info = inputData;
    return objectToReturn;
};

export let addQualUnitToQPG = function( selectedObjs, ctx ) {
    var inputData = [];
    var selectedQPG = ctx.mselected;
    var existingQualUnits = [];

    if ( ctx && ctx.mselected && ctx.mselected[0].type === 'Tq0QualProfileGroup' ) {
        existingQualUnits = ctx.mselected[0].props.tq0QualUnitList.dbValues;
    }
    for ( var i = 0; i < selectedObjs.length; i++ ) {
        existingQualUnits.push( selectedObjs[i].uid );
    }
    var infoObj = {};
    infoObj.object =  { type: selectedQPG[0].type, uid: selectedQPG[0].uid };
    infoObj.timestamp = '';

    var prop = {};
    prop.name = 'tq0QualUnitList';

    prop.values = existingQualUnits;

    var vecNameVal = [];
    vecNameVal.push( prop );

    infoObj.vecNameVal = vecNameVal;

    inputData.push( infoObj );

    return inputData;
};

/**
 * This function changes the uiValue of properties to display their displayNames on UI
 * @returns {object} object with uiValues for properties
 */
export let  displayReleaseSchedule = function( i18n ) {
    let ctx = appCtxSvc.getCtx();
    let releaseScheduleLabelUiVal = '';
    let tempReleaseAfterDays = '';
    let tempReleaseAfterDateVal = '';
    let AllowEarlyReleaseUiVal = '';
    let RequalificationRequiredUiVal = '';

    if( ctx.selected.props.tq0ImmediateRelease.dbValue === true && ctx.NONE._editing === false ) {
        releaseScheduleLabelUiVal = i18n.tq0WhenApproved;
    } else if( ctx.selected.props.tq0ReleaseAfterDays.dbValues[0] !== null && ctx.NONE._editing === false ) {
        releaseScheduleLabelUiVal = i18n.tq0DelaybyDays;
        tempReleaseAfterDays = ctx.selected.props.tq0ReleaseAfterDays.dbValues[0];
    } else if( ctx.selected.props.tq0ReleaseAfterDate.dbValues[0] !== null && ctx.NONE._editing === false ) {
        releaseScheduleLabelUiVal = i18n.tq0DelaybyDate;
        tempReleaseAfterDateVal = ctx.selected.props.tq0ReleaseAfterDate.uiValue;
    }
    AllowEarlyReleaseUiVal = ctx.selected.props.tq0AllowEarlyRelease.uiValue === '' ? 'False' : ctx.selected.props.tq0AllowEarlyRelease.uiValue;
    RequalificationRequiredUiVal = ctx.selected.props.tq0RequalificationRequired.uiValue === '' ? 'False' : ctx.selected.props.tq0RequalificationRequired.uiValue;

    return {
        releaseScheduleLabelVal: releaseScheduleLabelUiVal,
        delayByDaysTextVal: tempReleaseAfterDays,
        dateDetailVal: tempReleaseAfterDateVal,
        AllowEarlyReleaseVal: AllowEarlyReleaseUiVal,
        RequalificationRequiredVal: RequalificationRequiredUiVal
    };
};

/**
 *
 * @param {Object} input  - input for setProperties
 * @returns {Object} - promise object
 */
var callSaveEditSoa = function( input ) {
    return soaService.post( 'Core-2010-09-DataManagement', 'setProperties', input ).then(
        function( response ) {
            eventBus.publish( 'cdm.relatedModified', {
                refreshLocationFlag: true,
                relatedModified: [ appCtxSvc.ctx.selected ]
            } );
            return response;
        },
        function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            return error;
        }
    );
};

/**
 * Save edit for release schedule
 * @param {Object} - data- data object
 */
export let saveEditForReleaseSchedule = function( data ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    if( !activeEditHandler.editInProgress() ) {
        let soaInput = getSaveEditInput( data );
        callSaveEditSoa( soaInput );
    }
};


export let getSaveHandlerForQU = function() {
    return saveEditHandler;
};

export default exports = {
    getValidObjectsToAdd,
    populateGroupLOV,
    populateRoleLOV,
    performRoleSearchByGroup,
    getAssignQUsSoaInp,
    getVersionQUsSoaInp,
    executePostVersionEventActionsForQU,
    DeletionSuccess,
    getPrerequisiteValues,
    getQualUnitList,
    getVersionQUsSoaInputForPrereq,
    searchQualificationUnit,
    checkTargetEntityAddedOrNot,
    searchQualificationDefinitions,
    changeRadioForDelayedRelease,
    getSaveHandlerForQU,
    editStateChangeForRenewalSchedule,
    displayReleaseSchedule,
    saveEditForReleaseSchedule,
    addQualUnitToQPG,
    getVersionQDSoaInput,
    executePostVersionEventActionsForQD
};
