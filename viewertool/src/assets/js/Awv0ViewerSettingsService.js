// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awv0ViewerSettingsService
 */
import { getBaseUrlPath } from 'app';
import viewerPreferenceService from 'js/viewerPreference.service';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import messagingService from 'js/messagingService';
import localeSvc from 'js/localeService';
import listBoxService from 'js/listBoxService';
import modelPropertySvc from 'js/modelPropertyService';
import viewerContextService from 'js/viewerContext.service';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import viewerSessionStorageService from 'js/viewerSessionStorageService';
import viewerOcclusionCullingService from 'js/viewerOcclusionCullingService';


var exports = {};

var Units = {
    MILLIMETERS: 1,
    CENTIMETERS: 2,
    METERS: 3,
    INCHES: 4,
    FEET: 5,
    YARDS: 6,
    MICROMETERS: 7,
    DECIMETERS: 8,
    KILOMETERS: 9,
    MILS: 10
};

let occCullingUIMap = {
    Standard:0,
    Fast:1,
    Faster:2,
    Fastest:3
};

/**
 * offset delta value to be used for calculating floor offset
 */
var m_offsetDelta = 0.5;

var materialData = [ { iconName: '01ShinyMetal', tooltip: getLocalizedText( 'materialTooltip1' ) },
    { iconName: '02BrushedMetal', tooltip: getLocalizedText( 'materialTooltip2' ) },
    { iconName: '03ShinyPlastic', tooltip: getLocalizedText( 'materialTooltip3' ) },
    { iconName: '04Analysis', tooltip: getLocalizedText( 'materialTooltip4' ) },
    { iconName: '05Flat', tooltip: getLocalizedText( 'materialTooltip5' ) },
    { iconName: '06RedGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip6' ) },
    { iconName: '07BlueGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip7' ) },
    { iconName: '08GreenGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip8' ) },
    { iconName: '09GrayGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip9' ) },
    { iconName: '10BlackGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip10' ) },
    { iconName: '11BrownGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip11' ) },
    { iconName: '12YellowGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip12' ) },
    { iconName: '13TealGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip13' ) },
    { iconName: '14WhiteGlossyPlastic', tooltip: getLocalizedText( 'materialTooltip14' ) },
    { iconName: '15ClearPlastic', tooltip: getLocalizedText( 'materialTooltip15' ) },
    { iconName: '16Chrome', tooltip: getLocalizedText( 'materialTooltip16' ) },
    { iconName: '17Copper', tooltip: getLocalizedText( 'materialTooltip17' ) },
    { iconName: '18Gold', tooltip: getLocalizedText( 'materialTooltip18' ) },
    { iconName: '19Brass', tooltip: getLocalizedText( 'materialTooltip19' ) },
    { iconName: '20Steel', tooltip: getLocalizedText( 'materialTooltip20' ) },
    { iconName: '21BrushedChrome', tooltip: getLocalizedText( 'materialTooltip21' ) },
    { iconName: '22BrushedAluminum', tooltip: getLocalizedText( 'materialTooltip22' ) },
    { iconName: '23Titanium', tooltip: getLocalizedText( 'materialTooltip23' ) },
    { iconName: '24Glass', tooltip: getLocalizedText( 'materialTooltip24' ) },
    { iconName: '25SmokeyGlass', tooltip: getLocalizedText( 'materialTooltip25' ) },
    { iconName: '26RedPaint', tooltip: getLocalizedText( 'materialTooltip26' ) },
    { iconName: '27GrayPaint', tooltip: getLocalizedText( 'materialTooltip27' ) },
    { iconName: '28BlackPaint', tooltip: getLocalizedText( 'materialTooltip28' ) },
    { iconName: '29BluePaint', tooltip: getLocalizedText( 'materialTooltip29' ) },
    { iconName: '30Rubber', tooltip: getLocalizedText( 'materialTooltip30' ) }
];

const VIEW_PREF_VIS_MATERIAL_PATH = 'viewerPreference.AWC_visMaterial'; //$NON-NLS-1$
const VIEW_PREF_PMI_CHECKED_PATH = 'viewerPreference.pmiChecked'; //$NON-NLS-1$
const VIEW_PREF_VIS_FLOOR_ORIANTATION_PATH = 'viewerPreference.AWC_visFloorPlaneOrientation'; //$NON-NLS-1$
const VIEW_IS_TRANSPARENCY_UPDATED_FLAG_PATH = viewerContextService.VIEWER_NAMESPACE_TOKEN + '.isTransparencyUpdated'; //$NON-NLS-1$

const MANIPULATOR_TYPE_EXAMINE = 1;
const MANIPULATOR_TYPE_WALK = 0;

/**
 * Viewer settings panel revealed
 *
 * @function viewerSettingsPanelRevealed
 * @param {Object} viewerData this contains value of panelContext from ctx
 * @param {Object} shadedCheckboxProp shaded property
 * @param {Object} navigationRadioProp navigation property[Walk/Examine]
 * @param {Object} useIndexedCheckboxProp useIndexed property
 * @param {Object} modelTitleProp modelTitle property
 * @param {Object} unitTextProp unitText property
 * @param {Object} localeTextBundle localized text
 * @param {Object} renderSourceRadioProp Render Source property (SSR/CSR)
 * @param {Object} floorPlanProp floor plan Oriantatio property
 * @param {Object} floorPlanPropValues floor plan list
 */
export let viewerSettingsPanelRevealed = function( viewerData, shadedCheckboxProp, navigationRadioProp, useIndexedCheckboxProp, modelTitleProp, unitTextProp, localeTextBundle, renderSourceRadioProp,
    modelName, materialProp, floorPlanProp, floorPlanPropValues ) {
    const _unitTextProp = _.clone( unitTextProp );
    const _useIndexedCheckboxProp = _.clone( useIndexedCheckboxProp );

    const _renderSourceRadioProp = _.clone( renderSourceRadioProp );
    const _materialProp = _.clone( materialProp );
    const _modelTitleProp = _.clone( modelTitleProp );
    const _shadedCheckboxProp = _.clone( shadedCheckboxProp );
    const _floorPlanProp = _.clone( floorPlanProp );
    const _navigationRadioProp = _.clone( navigationRadioProp );

    let viewerContextData = viewerData.viewerContextData;
    if( !viewerContextData.isMMVRendering() ) {
        _shadedCheckboxProp.isVisible = true;
        _shadedCheckboxProp.dbValue = viewerPreferenceService.getShadedWithEdgesPreference( viewerContextData );
    }

    _navigationRadioProp.isEnabled = navigator.userAgent.indexOf( 'iPad' ) < 0; // not supported on ipad
    let hasAlternatePCI = viewerContextData.getHasAlternatePCI();
    if( hasAlternatePCI ) {
        _useIndexedCheckboxProp.isVisible = true;
        let alternatePCI = viewerPreferenceService.getUseAlternatePCIPreference( viewerContextData );
        if( alternatePCI === 'INDEXED' ) {
            _useIndexedCheckboxProp.dbValue = true;
        } else {
            _useIndexedCheckboxProp.dbValue = false;
        }
    } else {
        _useIndexedCheckboxProp.isVisible = false;
    }
    var modelUnit = viewerPreferenceService.getModelUnit( viewerContextData );
    var displayUnit = viewerPreferenceService.getDisplayUnit( viewerContextData );
    for( var key in Units ) {
        if( Units[ key ] === modelUnit ) {
            _modelTitleProp.uiValue = localeTextBundle[ key.toLowerCase() ];
        }
        if( Units[ key ] === displayUnit ) {
            _unitTextProp.uiValue = localeTextBundle[ key.toLowerCase() ];
        }
    }
    var renderSource = viewerContextData.getValueOnViewerAtomicData( 'renderLocation' );
    if( renderSource === 'SSR' ) {
        _renderSourceRadioProp.dbValue = true;
    } else if( renderSource === 'CSR' ) {
        _renderSourceRadioProp.dbValue = false;
    }
    var viewerCurrProdCtx = viewerContextData.getCurrentViewerProductContext();
    var currentProductProperties = viewerCurrProdCtx.props;
    modelName.uiValue = currentProductProperties.object_name !== undefined ? currentProductProperties.object_name.dbValues[ 0 ] : currentProductProperties.object_string.dbValues[ 0 ];

    var materialIndex = viewerContextData.getValueOnViewerAtomicData( VIEW_PREF_VIS_MATERIAL_PATH );
    _materialProp.materialIndex = materialIndex;
    _materialProp.iconName = materialData[ parseInt( materialIndex ) ].iconName;
    _materialProp.tooltip = materialData[ parseInt( materialIndex ) ].tooltip;
    _materialProp.iconUrl = getBaseUrlPath() + '/image/cmd' + materialData[ parseInt( materialIndex ) ].iconName + '24.svg';

    let floorVal = viewerContextData.getValueOnViewerAtomicData( VIEW_PREF_VIS_FLOOR_ORIANTATION_PATH );
    for( let i = 0; i < floorPlanPropValues.dbValue.length; i++ ) {
        if( floorVal === floorPlanPropValues.dbValue[ i ].propInternalValue ) {
            let floorPlanVal = floorPlanPropValues.dbValue[ i ];
            _floorPlanProp.dbValue = floorPlanVal.propInternalValue;
            _floorPlanProp.uiValue = floorPlanVal.propDisplayValue;
            _floorPlanProp.iconName = floorPlanVal.iconName;
            break;
        }
    }

    let _renderSupportInfo = viewerSessionStorageService.getViewerDataFromSessionStorage( 'renderSupportInfo' );
    viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, viewerData.subPanelContext.popupOptions.popupId );

    return {
        shadedCheckboxProp: _shadedCheckboxProp,
        navigationRadioProp: _navigationRadioProp,
        useIndexedCheckboxProp: _useIndexedCheckboxProp,
        modelTitleProp: _modelTitleProp,
        unitTextProp: _unitTextProp,
        renderSourceRadioProp: _renderSourceRadioProp,
        modelName: modelName,
        materialProp: _materialProp,
        floorPlanProp: _floorPlanProp,
        renderSupportInfo: _renderSupportInfo
    };
};

/**
 * Init PMI setting on reveal
 *
 * @function initPMISetting
 * @param {Object} viewerContextData this contains value of viewer context data from ctx.panelContext
 * @param {Object} pmiCheckboxProp PMI property
 *
 */
export let initPMISetting = function( viewerContextData, pmiCheckboxProp ) {
    return viewerContextData.getPmiManager().getHasPMI()
        .then( function( hasPMI ) {
            if( hasPMI ) {
                return viewerContextData.getPmiManager().getInPlane( viewerContextData ).then( function( inPlane ) {
                    viewerContextData.updateViewerAtomicData( VIEW_PREF_PMI_CHECKED_PATH, inPlane );
                    if( !inPlane ) {
                        exports.setPMIFaltToScreen( viewerContextData, true );
                        return updateShowPMIFlatToScreenTrue( pmiCheckboxProp );
                    }
                    return updateShowPMIFlatToScreenFalse( pmiCheckboxProp );
                } );
            }
            return pmiCheckboxProp;
        } );
};
/**
 *
 * @function viewerSettingsPanelRevealThemeProp
 *
 * @param {Object} data viewer settings data
 */
export let viewerSettingsPanelRevealThemeProp = function( data, viewerData ) {
    let deferred = AwPromiseService.instance.defer();
    let viewerContext = viewerData.viewerContextData;
    viewerContext.getThreeDViewManager().getBackgroundColorThemes().then( function( themesList ) {
        let internalValues = [];
        let values = [];
        let themeToDisplay;
        let themeIndexDisplay;
        let colorThemeToDisplay;
        let colorThemeToDisplayIndex;
        let colorTheme = viewerPreferenceService.getColorTheme( viewerContext );
        for( let i = 0; i < themesList.length; i++ ) {
            let themeCurrentObject = JSON.parse( themesList[ i ] );
            themeToDisplay = themeCurrentObject.Name;
            themeIndexDisplay = themeCurrentObject.Index;
            if( themeToDisplay === 'From Session' && colorTheme[ 0 ] === themeIndexDisplay ) {
                themeToDisplay = getLocalizedText( 'fromSession' );
                colorThemeToDisplay = getLocalizedText( 'fromSession' );
                colorThemeToDisplayIndex = themeIndexDisplay;
            } else if( colorTheme[ 0 ] === themeIndexDisplay ) {
                colorThemeToDisplay = themeToDisplay;
                colorThemeToDisplayIndex = themeIndexDisplay;
            }
            internalValues[ i ] = themeIndexDisplay;
            values[ i ] = themeToDisplay;
        }

        let themeProp = data.themeProp;
        let editData = {};
        themeProp.dbValue = colorThemeToDisplayIndex;
        themeProp.dispValue = colorThemeToDisplay;
        themeProp.uiValue = colorThemeToDisplay;

        let colorThemeList = listBoxService.createListModelObjectsFromStrings( values );
        for( let j = 0; j < internalValues.length; j++ ) {
            colorThemeList[ j ].propInternalValue = internalValues[ j ];
            colorThemeList[ j ].propDisplayValue = values[ j ];
        }
        editData = {
            themeProp: themeProp,
            colorThemeList: colorThemeList
        };
        deferred.resolve( editData );
    }, function( reason ) {
        deferred.reject( 'viewerRender: Failed to get list of Themes:' + reason );
    } );

    return deferred.promise;
};

/**
 * Update material field property with newly selected material theme index from popup
 *
 * @function materialThemeSelected
 * @param {String} index selected theme index
 * @param {Object} materialProp material field property
 */
export let materialThemeSelected = function( index, materialProp ) {
    let _materialProp = { ...materialProp.value };
    if( index && _materialProp.materialIndex !== index ) {
        _materialProp.materialIndex = index;
        materialProp.update( _materialProp );
    }
};
/**
 * Prepare list of material themes with field data
 *
 * @function initializeMaterialThemesList
 * @param {Array} lstMaterialGridProp this contains list of material property
 * @param {Object} fieldMaterialProp this contains field material property
 * @returns {Array} list of Material Themes List with field data
 */
export let initializeMaterialThemesList = function( lstMaterialGridProp, fieldMaterialProp ) {
    return lstMaterialGridProp.map( prop => {
        return { ...prop, fieldMaterialProp: fieldMaterialProp };
    } );
};

/**
 * Generate viewModel property for material theme
 *
 * @function generateMaterialThemeProp
 * @param {Object} materialGridProp this contains material property
 * @returns {Object} viewModel propetry for material property
 */
export let generateMaterialThemeProp = function( materialGridProp ) {
    return modelPropertySvc.createViewModelProperty( materialGridProp );
};

/**
 * Set shaded mode in viewer
 *
 * @function shadedWithEdgesSettingChanged
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let shadedWithEdgesSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getThreeDViewManager().setBasicDisplayMode( isChecked ? 1 : 0 ).then( function() {
        viewerPreferenceService.setShadedWithEdgesPreference( isChecked, viewerContextData );
    } );
};

/**
 * Apply true shading material in viewer
 *
 * @function materialSettingChanged
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let materialSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().enableMaterials( isChecked ).then( function() {
        viewerPreferenceService.setApplyTrueShadingMaterial( isChecked, viewerContextData );
    } );
};

/**
 * Set trihedron setting for viewer
 * @function trihedronSettingChanged
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let trihedronSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getDrawTrislingManager().drawTrihedron( isChecked );
    viewerContextData.getDrawTrislingManager().drawNavCube( isChecked );
    viewerPreferenceService.setTrihedronVisibility( isChecked, viewerContextData );
};

/**
 * Revert render setting to SSR/CSR
 *
 * @function revertRenderSetting
 *
 * @param {Object} renderSourceRadioProp - render Source[SSR/CSR] property
 * @param {Object} renderOptionEvent - Revert to SSR/CSR
 *
 * @returns {Object} render Source property
 */
export let revertRenderSetting = function( renderSourceRadioProp, renderOptionEvent ) {
    var _renderSourceRadioProp = _.clone( renderSourceRadioProp );

    if( renderOptionEvent === 'RevertToSSR' ) {
        _renderSourceRadioProp.dbValue = true;
    } else if( renderOptionEvent === 'RevertToCSR' ) {
        _renderSourceRadioProp.dbValue = false;
    }
    return {
        renderSourceRadioProp: _renderSourceRadioProp
    };
};

/**
 * Reset render source option on user cancellation
 *
 * @function renderSourceChangeCancelled
 *
 * @param {Object} renderSourceRadioProp - render Source property
 *
 * @returns {Object} render Source property
 */
export let renderSourceChangeCancelled = function( renderSourceRadioProp ) {
    const _renderSourceRadioProp = _.clone( renderSourceRadioProp );
    _renderSourceRadioProp.dbValue = !_renderSourceRadioProp.dbValue;
    return {
        renderSourceRadioProp: _renderSourceRadioProp
    };
};

/**
 * changing the render source on user confirmation
 *
 * @function renderSourceChangeSuccess
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Object} renderSourceRadioProp - render Source property
 *
 * @returns {Object} render Source property
 */
export let renderSourceChangeSuccess = function( viewerContextData, renderSourceRadioProp ) {
    const _renderSourceRadioProp = _.clone( renderSourceRadioProp );
    let renderMode = 'CSR';
    if( _renderSourceRadioProp.dbValue === true ) {
        renderMode = 'SSR';
    } else {
        renderMode = 'CSR';
    }
    viewerContextData.updateViewerAtomicData( 'renderLocation', renderMode );
    return {
        renderSourceRadioProp: _renderSourceRadioProp
    };
};

/**
 * set render source as server in UI
 *
 * @function viewerRenderSourceChanged
 *
 * @param {Object} viewerCurrCtx this contains Viewer Context Data
 * @param {Object} renderSourceRadioProp - render Source property
 */
export let viewerRenderSourceChanged = function( viewerCurrCtx, renderSourceRadioProp ) {
    let renderOptionEvent = null;
    if( renderSourceRadioProp.dbValue ) {
        if( !viewerCurrCtx.isServerSideRenderPossible() ) {
            messagingService.showInfo( viewerCurrCtx.getThreeDViewerMsg( 'ssrNotSupported' ) );
            renderOptionEvent = 'RevertToCSR';
        } else {
            renderOptionEvent = 'Server';
        }
    } else {
        if( viewerCurrCtx.isMMVRendering() ) {
            messagingService.showInfo( viewerCurrCtx.getThreeDViewerMsg( 'mmvDataNotViewable' ) );
            renderOptionEvent = 'RevertToSSR';
        } else {
            renderOptionEvent = 'Client';
        }
    }
    return {
        renderOptionEvent: renderOptionEvent
    };
};

/**
 * Set floor setting for viewer
 *
 * @function showFloorSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let showFloorSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().setFloor( isChecked );
    viewerPreferenceService.setFloorVisibility( isChecked, viewerContextData );
};

/**
 * Set grid setting for viewer
 *
 * @function gridSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let gridSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().setFloorGrid( isChecked );
    viewerPreferenceService.setGridVisibility( isChecked, viewerContextData );
};

/**
 * Set shadow setting for viewer
 *
 * @function shadowSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let shadowSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().enableFloorShadow( isChecked ).then( function() {
        viewerPreferenceService.setShadowVisibility( isChecked, viewerContextData );
    } );
};

/**
 * Set reflection setting for viewer
 *
 * @function reflectionSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let reflectionSettingChanged = function( viewerContextData, isChecked ) {
    viewerContextData.getVqSceneManager().enableFloorReflection( isChecked ).then( function() {
        viewerPreferenceService.setReflectionVisibility( isChecked, viewerContextData );
    } );
};

/**
 * Set navigation 3D mode for viewer
 *
 * @function navigationSettingChanged
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {boolean} isChecked - true if checked
 */
export let navigationSettingChanged = function( viewerContextData, isChecked ) {
    if( isChecked ) {
        viewerContextData.getNavigationManager().setManipulatorType( MANIPULATOR_TYPE_EXAMINE ); /* 1: EXAMINE */
        viewerPreferenceService.setThreeDNavigationMode( viewerPreferenceService.ThreeDNavigationMode.EXAMINE, viewerContextData );
    } else {
        viewerContextData.getNavigationManager().setManipulatorType( MANIPULATOR_TYPE_WALK ); /* 0: WALK */
        viewerPreferenceService.setThreeDNavigationMode( viewerPreferenceService.ThreeDNavigationMode.WALK, viewerContextData );
    }
};

/**
 * Update Material widget
 */
export let updateMaterialWidget = function( viewerContextData, materialIndex, materialProp ) {
    const _materialProp = _.clone( materialProp );
    if( materialIndex === null ) {
        return _materialProp;
    }

    _materialProp.iconName = materialData[ materialIndex ].iconName;
    _materialProp.iconUrl = getBaseUrlPath() + '/image/cmd' + materialData[ materialIndex ].iconName + '24.svg';
    _materialProp.tooltip = materialData[ materialIndex ].tooltip;
    _materialProp.materialIndex = materialIndex;

    viewerContextData.getVqSceneManager().setGlobalMaterial( parseInt( materialIndex ) );
    viewerPreferenceService.setGlobalMaterial( materialIndex, viewerContextData );
    return { materialProp: _materialProp };
};

/**
 * Handle slider change event
 *
 * @function handleSliderChangeEvent
 *
 * @param {Object} viewerData this contains Viewer Context Data
 * @param {Number} sliderValue - new slider value
 * @param {Object} floorSliderProp - slider property
 */
export let handleSliderChangeEvent = function( viewerData, sliderValue, floorSliderProp ) {
    var _floorSliderProp = _.clone( floorSliderProp );
    let viewerContextData = viewerData.viewerContextData;

    var currentOffset = viewerPreferenceService.getFloorOffset( viewerContextData );
    var newOffsetValue = null;
    if( sliderValue > 50 ) {
        newOffsetValue = currentOffset + m_offsetDelta;
    } else if( sliderValue < 50 ) {
        newOffsetValue = currentOffset - m_offsetDelta;
    }
    if( newOffsetValue !== null ) {
        viewerContextData.getVqSceneManager().setFloorOffset( newOffsetValue );
        viewerPreferenceService.setFloorOffset( newOffsetValue, viewerContextData );

        if( _floorSliderProp !== null ) {
            _floorSliderProp.dbValue[ 0 ].sliderOption.value = 50;
        }
    }

    return _floorSliderProp;
};

/**
 * Handle floor plane change event
 *
 * @function viewerFloorPlaneChanged
 *
 * @param {String} planeId - new viewer plane id
 * @param {Object} viewerContextData - this contains Viewer Context Data
 */
export let viewerFloorPlaneChanged = function( planeId, viewerContextData, floorPlanProp ) {
    viewerContextData.getVqSceneManager().setFloorPlaneOrientation( parseInt( planeId ) );
    viewerPreferenceService.setFloorOrientation( planeId, viewerContextData );
};

/**
 * Set pmi flat to screen visibility to false
 *
 * @param {Object} pmiCheckboxProp
 */
export let updateShowPMIFlatToScreenFalse = function( pmiCheckboxProp ) {
    if( !pmiCheckboxProp ) {
        return pmiCheckboxProp;
    }
    const _pmiCheckboxProp = _.clone( pmiCheckboxProp );

    _pmiCheckboxProp.isVisible = true;
    _pmiCheckboxProp.dbValue = false;

    return _pmiCheckboxProp;
};

/**
 * Set pmi flat to screen visibility to true
 *
 * @param {Object} pmiCheckboxProp
 */
export let updateShowPMIFlatToScreenTrue = function( pmiCheckboxProp ) {
    if( !pmiCheckboxProp ) {
        return pmiCheckboxProp;
    }
    const _pmiCheckboxProp = _.clone( pmiCheckboxProp );

    _pmiCheckboxProp.isVisible = true;
    _pmiCheckboxProp.dbValue = true;

    return _pmiCheckboxProp;
};

/**
 * Update transparency setting in viewer setting panel sync with 3D page.
 *
 * @param  {Object} useTransparencyCheckboxProp useTransparencyCheckbox Property
 * @param {Object} viewerContextData viewer context data
 * @return {Object} useTransparencyCheckboxProp useTransparencyCheckbox Property
 */
export let updateSelectionDisplayTransparent = function( useTransparencyCheckboxProp, viewerContextData ) {
    if( !useTransparencyCheckboxProp && !viewerContextData ) {
        return useTransparencyCheckboxProp;
    }
    let transparency = viewerContextData.getValueOnViewerAtomicData( 'viewerPreference.AWC_visSelectionDisplay' );
    const _useTransparencyCheckboxProp = _.clone( useTransparencyCheckboxProp );
    _useTransparencyCheckboxProp.dbValue = transparency;
    return _useTransparencyCheckboxProp;
};

/**
 * Cleanup on Viewer Setting panel close
 *
 */
export let cleanupViewerSettingPanelAction = function( viewerContextData ) {
    if( appCtxSvc.getCtx( VIEW_IS_TRANSPARENCY_UPDATED_FLAG_PATH ) !== undefined ) {
        appCtxSvc.unRegisterCtx( VIEW_IS_TRANSPARENCY_UPDATED_FLAG_PATH );
    }
    viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_ACTIVE_DIALOG_ENABLED, null );
};

/**
 * Set selection display mode
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {String} isUseTransparency is use transparency value
 */
export let useTransparencySettingChanged = function( viewerContextData, isUseTransparency ) {
    viewerContextService.setUseTransparency( viewerContextData, isUseTransparency );
};

/**
 * Set Indexed/Non-Indexed Model
 *
 * @param {Object} useIndexedCheckboxProp is use Indexed Model Object
 *
 * @return {Object} useIndexedCheckboxProp object with new Indexed Mode
 */
export let useIndexedSettingChanged = function( viewerContextData, useIndexedCheckboxProp ) {
    var optionValue = useIndexedCheckboxProp.dbValue ? 'INDEXED' : 'NON_INDEXED';
    viewerPreferenceService.setUseAlternatePCIPreference( optionValue, viewerContextData );
};

/**
 * To set PMI flat to screen
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Boolean} setFlatToScreen - Boolean flag to indicate if PMI should be set flat to screen or not.
 */
export let setPMIFaltToScreen = function( viewerContextData, setFlatToScreen ) {
    viewerContextData.getPmiManager().setInPlane( !setFlatToScreen ).then( function() {
        viewerPreferenceService.setPMIOption( setFlatToScreen, viewerContextData );
    } );
};

/**
 * to set display unit
 */
export let setDisplayUnit = function( viewerContextData, selectedUnit, localeTextBundle ) {
    var selDisplayUnit = Object.keys( localeTextBundle ).find( function( key ) {
        return localeTextBundle[ key ] === selectedUnit;
    } );
    var unitConst = Units[ selDisplayUnit.toUpperCase() ];
    viewerPreferenceService.setDisplayUnit( unitConst, viewerContextData );
    viewerContextData.getThreeDViewManager().setDisplayUnit( unitConst );
};

/**
 * Set Occlusion culling
 * @param {Object} viewerContextData viewer context data
 * @param {Number} currentValue value selected in UI
 * @return {Promise} Promise which resolve
 */
export let setOccCulling = function( viewerContextData, currentValue ) {
    return viewerOcclusionCullingService.getOccCulling( viewerContextData.getCurrentViewerProductContext() ).then( ( occCullingValue ) => {
        let uiIndex = _getOccCullingInternalValueIndex( occCullingValue );
        if( uiIndex !== undefined && uiIndex !== currentValue.dbValue ) {
            let occCullingMode = Object.keys( occCullingUIMap ).find( key=>occCullingUIMap[key] ===  currentValue.dbValue );
            viewerOcclusionCullingService.setOccCulling( occCullingMode, viewerContextData.getCurrentViewerProductContext(), viewerContextData );
            if( uiIndex === 0 && currentValue.dbValue > 0 ||  uiIndex > 0 && currentValue.dbValue === 0 ) {
                eventBus.publish( 'occculling.update', {} );
            } else {
                viewerContextData.getPerformanceManager().setOcclusionCulling( viewerOcclusionCullingService.getOccCullingValue( occCullingMode ) );
            }
        }
    } );
};

/**
 * Return occlusion culling ui internal value index
 * @param {Number} occCullingValue occlusion culling value
 * @returns {Number} uiIndex
 */
let _getOccCullingInternalValueIndex = ( occCullingValue )=>{
    let occCullingValueKey = Object.keys( viewerOcclusionCullingService.CSRLoadingStrategy ).find( key=>viewerOcclusionCullingService.CSRLoadingStrategy[key] === occCullingValue );
    return Object.values( occCullingUIMap ).find( value=>occCullingUIMap[occCullingValueKey] === value );
};

/*
 * Set occlusion culling in UI after panel reveal
 * @param {Object} occCullProp occlusion culling view model prop
 * @param {Object} occCullingList occlusion culling list of values
 * @param {Object} viewerContextData viewer context data
 * @returns {object} modified occlusion culling prop
 */
export let viewerSettingsPanelRevealOccCullingProp = function( occCullProp, occCullingList, viewerContextData ) {
    if( occCullProp.dbValue === '' ) {
        return viewerOcclusionCullingService.getOccCulling( viewerContextData.getCurrentViewerProductContext() ).then( ( occCullingValue ) => {
            let uiIndex = _getOccCullingInternalValueIndex( occCullingValue );
            if( occCullingValue !== undefined ) {
                let retOccCullProp = { ...occCullProp };
                retOccCullProp.dbValue = occCullingList.dbValue[uiIndex].propInternalValue;
                retOccCullProp.dispValue = occCullingList.dbValue[uiIndex].propDisplayValue;
                retOccCullProp.uiValue = occCullingList.dbValue[uiIndex].propDisplayValue;
                return retOccCullProp;
            }
        } );
    }
    return occCullProp;
};


/**
 * to set color theme
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Object} currentTheme this contains current theme
 * @param {Array} colorThemeList this contains current theme list
 */
export let setColorTheme = function( viewerContextData, currentTheme, colorThemeList ) {
    if( currentTheme.dbValue.propInternalValue !== 'From Session' ) {
        let colorThemeListData = colorThemeList;
        for( let i = 0; i < colorThemeListData.length; i++ ) {
            if( colorThemeListData[ i ].propInternalValue === 'From Session' ) {
                colorThemeListData[ i ].propDisplayValue = null;
                colorThemeListData[ i ].dispValue = null;
                colorThemeListData[ i ].propInternalValue = null;
                colorThemeListData[ i ] = null;
                colorThemeListData.length -= 1;
            }
        }
        let colorTheme = viewerPreferenceService.getColorTheme( viewerContextData );
        if( colorTheme ) {
            if( colorTheme !== currentTheme.dbValue ) {
                viewerPreferenceService.setColorTheme( currentTheme.dbValue, viewerContextData );
            }
        }
        viewerContextData.getThreeDViewManager().setBackgroundColorTheme( currentTheme.dbValue );
    }
};

/**
 * Get the localized text for given key
 *
 * @param {String} key Key for localized text
 * @return {String} The localized text
 */
function getLocalizedText( key ) {
    var localeTextBundle = getLocaleTextBundle();
    return localeTextBundle[ key ];
}

/**
 * This method finds and returns an instance for the locale resource.
 *
 * @return {Object} The instance of locale resource if found, null otherwise.
 */
function getLocaleTextBundle() {
    var resource = 'ViewerSettingsToolMessages';
    var localeTextBundle = localeSvc.getLoadedText( resource );
    if( localeTextBundle ) {
        return localeTextBundle;
    }
    return null;
}

/**
 * to download vis diagnostics file
 * @param {Object} viewerContextData this contains Viewer Context Data
 */
export let downloadVisDiagnosticsFile = function( viewerContextData ) {
    var launchFileContents = '';

    viewerContextService.logVisDiagnostics( false ).then( function( diagnosticData ) {
        launchFileContents = diagnosticData;

        var hrefValue = 'data:text/plain;charset=utf-8,' + encodeURIComponent( launchFileContents );
        var filename = 'logVisDiagnostics.log';

        //IE doesn't support download attribute; need alternative method to download correct filename
        var browserIsIE = navigator.userAgent.indexOf( 'MSIE' ) > -1 || navigator.appVersion.indexOf( 'Trident/' ) > -1;

        if( browserIsIE ) {
            var file = new Blob( [ launchFileContents ], { type: 'text/plain' } );
            navigator.msSaveOrOpenBlob( file, filename );
        } else {
            var a = document.createElement( 'a' );
            a.setAttribute( 'href', hrefValue );
            a.setAttribute( 'download', filename );

            if( document.createEvent ) {
                var event = document.createEvent( 'MouseEvents' );
                event.initEvent( 'click', true, true );
                a.dispatchEvent( event );
            } else {
                a.click();
            }
        }
    } );
};

export default exports = {
    viewerSettingsPanelRevealed,
    viewerSettingsPanelRevealThemeProp,
    viewerSettingsPanelRevealOccCullingProp,
    shadedWithEdgesSettingChanged,
    materialSettingChanged,
    trihedronSettingChanged,
    revertRenderSetting,
    renderSourceChangeCancelled,
    renderSourceChangeSuccess,
    viewerRenderSourceChanged,
    showFloorSettingChanged,
    gridSettingChanged,
    shadowSettingChanged,
    reflectionSettingChanged,
    navigationSettingChanged,
    updateMaterialWidget,
    handleSliderChangeEvent,
    viewerFloorPlaneChanged,
    updateShowPMIFlatToScreenFalse,
    updateShowPMIFlatToScreenTrue,
    updateSelectionDisplayTransparent,
    useTransparencySettingChanged,
    useIndexedSettingChanged,
    setPMIFaltToScreen,
    setDisplayUnit,
    setColorTheme,
    setOccCulling,
    initializeMaterialThemesList,
    generateMaterialThemeProp,
    materialThemeSelected,
    initPMISetting,
    downloadVisDiagnosticsFile,
    cleanupViewerSettingPanelAction
};
