// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import cdm from 'soa/kernel/clientDataModel';
import epTableService from 'js/epTableService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import _ from 'lodash';

/**
 * Tabs Service for EasyPlan.
 *
 * @module js/epTabsService
 */

/**
 * Set the tab display name with its contentCount (number of object displayed in the tab content) in parenthesis
 *
 * @param {Object} tabData - the tabs data as json object
 * @returns {Object} updated tab data
 */
export function setTabDisplayNameWithQuantity( tabData ) {
    if( tabData ) {
        tabData.namePrefix = !tabData.namePrefix ? tabData.name : tabData.namePrefix;
        tabData.name = !tabData.contentCount || tabData.contentCount === 0 || tabData.contentCount === '0' ? tabData.namePrefix : `${tabData.namePrefix} (${tabData.contentCount})`;
    }
    return tabData;
}

/**
 * addCountAndTotalToTabTitle
 * This method sets title for tab, including total count. For example Time Management (2 out of 6 activities)
 * 2 is the count, 6 is the total count
 *
 * @param {Object} tabData tab data
 * @param {Integer} count count
 * @param {Integer} totalCount total object count
 * @param {String} messageToFormat  messageToFormat
 */
export function addCountAndTotalToTabTitle( tabData, count, totalCount, messageToFormat ) {
    if( !tabData ) {
        return;
    }
    let updatedTabData = { ...tabData };
    updatedTabData.contentCount = count;
    let countLabel = messageToFormat;
    countLabel = countLabel.replace( '{0}', updatedTabData.contentCount );
    countLabel = countLabel.replace( '{1}', totalCount );
    updatedTabData.tabs[ 0 ].name = updatedTabData.name + countLabel;
    mfeViewModelUtils.mergeValueInAtomicData( tabData, updatedTabData );
}

/**
 * resetTabTitle
 * This method sets tile for activities
 * @param {Object} tabData tab data
 */
export function resetTabTitle( tabData ) {
    if( !tabData ) {
        return;
    }
    let updatedTabData = { ...tabData };
    updatedTabData.tabs[ 0 ].name = updatedTabData.name;
    mfeViewModelUtils.mergeValueInAtomicData( tabData, updatedTabData );
}

/**
 * Get list of tabs that should display their contentCount (number of object displayed in the tab content)
 * in parenthesis next to their display name
 *
 * @param {Object} contentPanelData - the content panel ( having the tabs ) data as json object
 */
export function getListOfTabsToDisplayNameWithQuantity( contentPanelData ) {
    contentPanelData.displayNameWithQuantityTabs = contentPanelData.tabs.filter( tab => tab.loadInputObject );
}

/**
 * Get list of properties to load in order to have each tab contentCount (number of object displayed in the tab content)
 *
 * @param {Object} contentPanelData - the content panel ( having the tabs ) data as json object
 */
export function getAllPropertiesToLoad( contentPanelData ) {
    contentPanelData.allPropertiesToLoad = [];
    contentPanelData.allLoadTypes = [ epLoadConstants.GET_PROPERTIES ];
    contentPanelData.displayNameWithQuantityTabs.forEach( ( tab ) => {
        tab.loadInputObject.propertiesToLoad && contentPanelData.allPropertiesToLoad.push( ...tab.loadInputObject.propertiesToLoad );
        tab.loadInputObject.additionalPropertiesToLoad && contentPanelData.allPropertiesToLoad.push( ...tab.loadInputObject.additionalPropertiesToLoad );
        tab.loadInputObject.loadTypes && contentPanelData.allLoadTypes.push( ...tab.loadInputObject.loadTypes );
    } );
}

/**
 * Init all the relevant tabs contentCount
 *
 * @param {Object} tabsData - the tabs data as json object
 */
function initTabsContentCount( tabsData ) {
    if( tabsData ) {
        tabsData.forEach( ( tabData ) => {
            tabData.namePrefix = !tabData.namePrefix ? tabData.name : tabData.namePrefix;
            tabData.contentCount = 0;
            tabData.name = tabData.namePrefix;
        } );
    }
}

/**
 * In case an object is selected to display its related data in the details tabs than,
 * Calculate the number of objects to display in each tab to, display in parenthesis next to the tab display name.
 * In case no object to display its related data in tabs is selected, or more than one object is selected than,
 * Don't display anything next to the tab display name
 *
 * @param {String} objUid - the object uid to load its related data to display in tabs
 * @param {Object} contentPanelData - the tabs data as json object
 * @returns {Promse} a promise object
 */
export function calculateContentCountForEachTab( objUid, contentPanelData ) {
    let clonedContentPanelData = _.cloneDeep( contentPanelData );
    if( objUid ) {
        return epTableService.loadAllProperties( objUid, clonedContentPanelData.allPropertiesToLoad, clonedContentPanelData.allLoadTypes ).then( ( response ) => {
            const modelObject = cdm.getObject( objUid );
            clonedContentPanelData.displayNameWithQuantityTabs.forEach( ( tabData ) => {
                tabData.contentCount = 0;
                const propertiesToLoad = tabData.loadInputObject.propertiesToLoad;
                if( modelObject.props[ propertiesToLoad ] ) {
                    tabData.contentCount += modelObject.props[ propertiesToLoad ].dbValues ? modelObject.props[ propertiesToLoad ].dbValues.length : 0;
                    tabData.contentData = modelObject.props[ propertiesToLoad ].dbValues ? modelObject.props[ propertiesToLoad ].dbValues : '';
                }
                const objMapKeys = tabData.loadInputObject.loadedObjectMapKeys;

                if( objMapKeys && response.loadedObjectsMap && response.loadedObjectsMap[ objMapKeys ] ) {
                    tabData.contentCount += response.loadedObjectsMap[ objMapKeys ].length;
                }

                const relatedObjectMapKey = tabData.loadInputObject.relatedObjectMapKey;
                if( response.relatedObjectsMap && relatedObjectMapKey ) {
                    const additionalPropertiesMap = response.relatedObjectsMap[ objUid ] && response.relatedObjectsMap[ objUid ].additionalPropertiesMap2;
                    if( Array.isArray( relatedObjectMapKey ) ) {
                        relatedObjectMapKey.forEach( prop => {
                            if( additionalPropertiesMap[ prop ] ) {
                                tabData.contentCount += additionalPropertiesMap[ prop ].length;
                            }
                        } );
                    } else if( additionalPropertiesMap[ relatedObjectMapKey ] ) {
                        tabData.contentCount += additionalPropertiesMap[ relatedObjectMapKey ].length;
                    }
                }
                setTabDisplayNameWithQuantity( tabData );
            } );

            return clonedContentPanelData;
        } );
    }
    if( clonedContentPanelData.displayNameWithQuantityTabs ) {
        initTabsContentCount( clonedContentPanelData.displayNameWithQuantityTabs );
    }
    return new Promise( ( res ) => res( clonedContentPanelData ) );
}
/**
 * set Icon On Tab
 *
 * @param { ObjectArray } contentPanelData: content panel data with tabs details
 *   e.g: "tabs": [{
 *                   "name": "Process Tab",
 *                   "tabKey": "epProcess"
 *              }]
 * @param { String } tabKey: on which tab out of tabData we want to show icon
 * @param { Boolean } shouldBeVisible: whether to set icon or unset icon
 * @param { String } iconName: which icon to set
 * @returns { ObjectArray } updated content panel data
 */
export function setIconOnTab( contentPanelData, tabKey, shouldBeVisible, iconName ) {
    if( contentPanelData.tabs ) {
        const tabIndex = contentPanelData.tabs.findIndex( ( tab ) => tab.tabKey === tabKey );
        if( tabIndex === -1 ) {
            return contentPanelData;
        }
        contentPanelData.tabs[ tabIndex ].iconId = shouldBeVisible ? iconName : '';
    }
    return { ...contentPanelData };
}

/**
 * Set label on tab
 * @param { ObjectArray } contentPanelData: content panel data with tabs details
 *   e.g: "tabs": [{
 *                   "name": "Process Tab",
 *                   "tabKey": "epProcess"
 *              }]
 * @param { String } tabKey: on which tab out of tabData we want to show icon
 * @param {String} name the text of the label
 * @returns { ObjectArray } updated content panel data
 */
export function setLabelOnTab( contentPanelData, tabKey, name, namePrefix ) {
    let clonedContentPanelData = _.cloneDeep( contentPanelData );
    clonedContentPanelData.tabs && clonedContentPanelData.tabs.forEach( ( tab ) => {
        if( tab.tabKey === tabKey ) {
            tab.name = name;
            if( namePrefix ) {
                tab.namePrefix = namePrefix;
            }
        }
    } );
    return clonedContentPanelData;
}

/**
 * Update the Tab Model as per the condition based on the structure type
 * @param {Object} tabsData - the tabs data as json object
 * @param {Array} tabsToBeRemoved - array of tab keys
 * @return {Object} updated tab data
 */
export function removeTabs( tabsData, tabsToBeRemoved ) {
    let clonedTabsData = _.cloneDeep( tabsData );
    let filteredTabs = tabsData.tabs.filter( tab => !tabsToBeRemoved.includes( tab.tabKey ) );
    clonedTabsData.tabs = filteredTabs;
    return clonedTabsData;
}

/**
 * Check whether a tab is in the tabs list
 *
 * @param {Object} tabsData - the tabs data as json object
 * @param {String} tabKey - the tabKey to search for in tabsData
 *
 * @returns {Boolean} tabKey exists
 */
export function tabExists( tabsData, tabKey ) {
    return tabsData.tabs.filter( ( tab ) => tab.tabKey === tabKey ).length > 0;
}

/**
 *
 * @param {Object} tabsData - the tabs data as json object
 * @param {Integer} tabIndex - a tab index
 * @param {Object} tabPropsKeyValueMap - the tab properties to update as {key:value} json
 * @param {String} cmdDisplayOption - tab option
 * @return {Object} the updated tabs data as json object
 */
export function updateTabPropKeyWithValueInTabs( tabsData, tabIndex, tabPropsKeyValueMap, cmdDisplayOption = undefined ) {
    for( const key in  tabPropsKeyValueMap ) {
        tabsData.tabs[tabIndex][key] ? tabsData.tabs[tabIndex][key] = tabPropsKeyValueMap[key] : null;
    }
    cmdDisplayOption ? tabsData.cmdDisplayOption = cmdDisplayOption : null;
    return tabsData;
}

/**
 * set Icon On Tab
 *
 * @param { Object } tabModels: tabs data
 * @param { String } tabKey: name of tab to select
 * @returns { Object } tabModels: updated tab data
 */
function setActiveTab( tabModels, tabKey ) {
    if ( tabModels && tabModels.tabs ) {
        const tab = tabModels.tabs.find( tab => tab.tabKey === tabKey );
        if ( tab && tabModels.tabs.indexOf( tab ) > 1 ) {
            tab.selectedTab = true;
            tabModels.tabs[0].selectedTab = false;
        }
    }
    return tabModels;
}

export default {
    updateTabPropKeyWithValueInTabs,
    setTabDisplayNameWithQuantity,
    addCountAndTotalToTabTitle,
    resetTabTitle,
    getListOfTabsToDisplayNameWithQuantity,
    getAllPropertiesToLoad,
    calculateContentCountForEachTab,
    setIconOnTab,
    setLabelOnTab,
    removeTabs,
    tabExists,
    setActiveTab
};
