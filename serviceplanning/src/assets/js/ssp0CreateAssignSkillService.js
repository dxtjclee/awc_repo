// Copyright (c) 2023 Siemens

/**
 * Service Plan functions
 *
 * @module js/ssp0CreateAssignSkillService
 */
import eventBus from 'js/eventBus';
import soaService from 'soa/kernel/soaService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';

const resource = 'ssp0Messages';
const localTextBundle = localeService.getLoadedText( resource );

var exports = {};

/**
 *
 * @param {Array} partialErrors - partial errors array
 */
let showError = function( partialErrors ) {
    for ( let i = 0; i < partialErrors.length; i++ ) {
        messagingService.showError( partialErrors[i].errorValues[0].message );
    }
};

export let getElementsToAdd = ( data ) => {
    var object = [];
    object = data.output[0].objects;
    var index = 0;
    for ( var i = 0; i < object.length; i++ ) {
        if ( object[i].type === 'SSP0WorkCardRevision' || object[i].type === 'SSP0ServiceReqRevision' ) {
            index = i;
            break;
        }
    }
    var array = [];
    array[0] = {
        uid: object[index].uid,
        type: object[index].type
    };
    return array;
};

export let getNewlyAddedChildElements = function( data ) {
    var newChildElements = [];

    if( data.addElementResponse.selectedNewElementInfo.newElements ) {
        for( var i = 0; i < data.addElementResponse.selectedNewElementInfo.newElements.length; ++i ) {
            newChildElements.push( data.addElementResponse.selectedNewElementInfo.newElements[ i ] );
        }
    }

    return newChildElements;
};
export let skillList = function( data ) {
    var skillList = [];
    if( data.searchResults ) {
        var skillNames = data.searchResults;
        for ( let i = 0; i < skillNames.length; i++ ) {
            let dbValue = skillNames[i].props.type_name.dbValues[0];
            let uiValue = skillNames[i].props.type_name.uiValues[0];

            skillList.push( {
                incompleteTail: true,
                propDisplayValue: uiValue,
                propInternalValue: dbValue,
                selected: false
            } );
        }
        if ( skillList.length > 0 ) {
            eventBus.publish( 'ssp0CreateAssignSkill.updateCurrentSkill', { currentSkillType: skillList[0] } );
        }
    }
    return skillList;
};

/**
  * Clone the type of Selected Object into the data
  * @param {Object} data data
  * @param {Object} fields fields
  * @return {Object} an object for given context
  */
export let changeAction = function( data, fields ) {
    var cloneData = { ...data };
    if( data.totalFound === 0 ) {
        cloneData.selectedType.dbValue = 'SSP0Skill';
    }else {
        cloneData.selectedType.dbValue = data.currentSkill.dbValue;
        const newObjectSetStateValue = { ...fields.xrtState.getValue() };
        newObjectSetStateValue.dpRef = fields.xrtState.dpRef;
        if ( fields.xrtState.update ) {
            fields.xrtState.update( newObjectSetStateValue );
        }
    }
    return cloneData;
};

export let attachSkills = async function(skills, selectedObject, data) {
    let openContextInput = [];
    for ( let i = 0; i < skills.length; i++ ) {
        openContextInput.push({
            openViews: false,
            openAssociatedContexts: true,
            object: skills[i].uid,
            contextSettings: {
                boolArrayProps: {},
                boolProps: {
                    ShowSuppressedOccs: true,
                    ShowUnconfiguredAssignedOccurrences: true,
                    ShowUnconfiguredVariants: true,
                    ShowUnconfiguredChanges: true,
                    ShowUnconfiguredOccurrencesEffectivity: true,
                    IsProductConfigurator: false
                },
                compoundCreateInput: {},
                dateArrayProps: {},
                dateProps: {},
                doubleArrayProps: {},
                doubleProps: {},
                floatArrayProps: {},
                floatProps: {},
                intArrayProps: {},
                intProps: {},
                stringArrayProps: {},
                stringProps: {},
                tagArrayProps: {},
                tagProps: {},
                type: ''
            }
        });
    }
    const input = {
        input: openContextInput
    };

    await soaService.post( 'Manufacturing-2011-06-DataManagement', 'openContexts', input ).then( 
        async function(response) {
            if ( response.partialErrors && response.partialErrors.length > 0  ) {
                showError( response.partialErrors );
            }else if( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length > 0 ) {
                showError( response.ServiceData.partialErrors );
            } else {
                let values = response.ServiceData.created.map(function (Objuid) {
                    return response.ServiceData.modelObjects[Objuid];
                });
                let skillBomLine = values.filter(function (value) {
                    return value.modelType.typeHierarchyArray.includes("BOMLine");
                });

                let input = [];
                for ( let i = 0; i < skillBomLine.length; i++ ) {
                    input.push( {
                        targetObjects: [ {
                            uid: selectedObject.uid,
                            type: selectedObject.type
                        } ],
                        sourceInfo: {
                            sourceObjects: [{
                                uid: skillBomLine[i].uid,
                                type: skillBomLine[i].type
                            }],
                            relationType: '',
                            relationName: '',
                            additionalInfo: {
                                stringArrayProps: {
                                    relationType: [""]
                                },
                                boolProps: {
                                    occTypeFromPreferenceFlag: true
                                }
                            }
                        }
                    } );
                }

                await soaService.postUnchecked( 'Manufacturing-2012-02-DataManagement', 'connectObjects', {
                    input: input
                } ).then( 
                    function(response) {
                        let msg = '';
                        if ( response.partialErrors && response.partialErrors.length > 0  ) {
                            showError( response.partialErrors );
                        } else if( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length > 0 ) {
                            showError( response.ServiceData.partialErrors );
                        } else {
                            msg =  localTextBundle.addMemberSuccessful;
                            msg = msg.replace( '{0}', data.i18n.Skill );
                            messagingService.showInfo( msg );
                        }
                    },
                    function (error) {
                        let errMessage = messagingService.getSOAErrorMessage(error);
                        messagingService.showError(errMessage);
                        throw error;
                    }
                );
            }
        }
    );
};

export default exports = {
    getElementsToAdd,
    getNewlyAddedChildElements,
    skillList,
    changeAction,
    attachSkills
};
