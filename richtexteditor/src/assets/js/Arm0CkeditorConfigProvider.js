// Copyright (c) 2022 Siemens

import { getBaseUrlPath } from 'app';
import { Arm0CkeditorConfigProviderBase } from 'js/Arm0CkeditorService';
import { getAutoCompleteItems } from 'js/rmCkeReuseToolIntegration/patternAssistHandler';
import localeSvc from 'js/localeService';

/**
 * Ckeditor Configuration provider
 * @module js/Arm0CkeditorConfigProvider
 */
export default class Arm0CkeditorConfigProvider extends Arm0CkeditorConfigProviderBase {
    /**
     * @param {Object} props - editor properties object
     */
    constructor( prop ) {
        super();
        this.editorProp = prop;
    }
    getCkeditor5Config() {
        if( this.editorProp.type === 'MINI' ) {
            return _getMiniCKEditor5Config( this.editorProp );
        }
        return _getAdvanceCKEditor5Config( this.editorProp );
    }
    getCkeditor5ConfigForWatermark() {
        return _getAdvanceCKEditor5ConfigWatermark( this );
    }
}

var UI_COLOR = '#FFFFFF';

/**
 * Return current local
 * @returns {String} locale name
 */
function _getLocaleName() {
    var currentLocale = localeSvc.getLocale();
    var localeName = '';

    if( currentLocale !== null && currentLocale !== '' ) {
        localeName = currentLocale.substring( 0, 2 );
    }

    // Normally first 2 characters, but we have 2 exceptions. And yes there is a dash and not an underscore.
    if( currentLocale === 'pt_BR' ) {
        localeName = 'pt-BR';
    } else if( currentLocale === 'zh_CN' ) {
        localeName = 'zh-CN';
    }

    return localeName;
}

/**
 * Return mathjax file path
 * @returns {String} -
 */
function _getMathJaxFilePath() {
    return getBaseUrlPath() + '/lib/mathJax/MathJax.js?config=TeX-AMS-MML_HTMLorMML';
}

/**
 * Return true if editor supports for multiple reuirements for authoring
 * @returns {Boolean} -
 */
function _isEditorForMultipleRequirements( editorProp ) {
    if( editorProp.dbValue && editorProp.dbValue.addNavigationCommands === true ) {
        return true;
    }
    return false;
}

/**
 * Return truen of need to exclude insert ole command
 * @returns {Boolean} -
 */
function _isExcludeInsertOLECommand( editorProp ) {
    if( editorProp.dbValue && editorProp.dbValue.excludeInsertOLECommand === true ) {
        return true;
    }
    return false;
}

/**
 * Return config for mini ckeditor for info panel
 * @param {Object} editorProp - editor property object
 * @returns {Object} -
 */
function _getMiniCKEditor5Config( editorProp ) {
    var localeName = _getLocaleName();
    return {
        toolbar: [
            'fontFamily',
            'fontSize',
            '|',
            'bold',
            'italic',
            'strikethrough',
            'link',
            'bulletedList',
            'numberedList',
            '|',
            'indent',
            'outdent',
            'alignment',
            '|',
            'insertTable',
            '|',
            'subscript',
            'superscript',
            '|',
            'fontBackgroundColor',
            'fontColor',
            '|',
            'undo',
            'redo',
            '|',
            // Custom commands
            'rmInsertImage',
            'rmInsertOLE'
        ],
        image: {
            resizeUnit: 'px',
            toolbar: [
                'imageTextAlternative',
                'imageStyle:full',
                'imageStyle:side'
            ]
        },
        table: {
            contentToolbar: [
                'tableColumn',
                'tableRow',
                'mergeTableCells',
                'tableCellProperties',
                'tableProperties'
            ]
        },
        fontSize: {
            options: [ 'default', 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72 ],
            supportAllValues: true
        },
        fontColor: {
            colors: customHexColorsConfig
        },
        fontBackgroundColor: {
            colors: customHexColorsConfig
        },
        language: localeName,
        mention: {
            feeds: [ {
                marker: ' ',
                feed: getAutoCompleteItems
            } ]
        },
        fontFamily: {
			options: [
				'맑은 고딕, Malgun Gothic, Gulim, Arial, Helvetica, sans-serif', 
				'굴림, Gulim, sans-serif', 
				'굴림체, GulimChe, sans-serif', 
				'바탕, Batang, Times New Roman, Times, serif', 
				'바탕체, BatangChe, Times New Roman, Times, serif', 
				'Arial, Helvetica, sans-serif',
				'Comic Sans MS, cursive',
				'Courier New, Courier, monospace',
				'Georgia, serif',
				'Lucida Sans Unicode, Lucida Grande, sans-serif',
				'Tahoma, Geneva, sans-serif',
				'Times New Roman, Times, serif',
				'Trebuchet MS, Helvetica, sans-serif',
				'Verdana, Geneva, sans-serif'
			],
            supportAllValues: true
        }
    };
}

/**
 * Return config for advanced ckeditor
 * @param {Object} editorProp - editor property object
 * @returns {Object} -
 */
function _getAdvanceCKEditor5Config( editorProp ) {
    var localeName = _getLocaleName();
    return {
        toolbar: [
            'fontFamily',
            'fontSize',
            '|',
            'bold',
            'italic',
            'underline',
            'strikethrough',
            'link',
            'bulletedList',
            'numberedList',
            '|',
            'indent',
            'outdent',
            'alignment',
            '|',
            'insertTable',
            '|',
            'subscript',
            'superscript',
            '|',
            'fontBackgroundColor',
            'fontColor',
            '|',
            'undo',
            'redo',
            '|',
            'findAndReplace',
            '|',
            // Custom commands
            'rmInsertImage',
            'rmInsertOLE',
            'math'
        ],
        heading: {
            options: [
                { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
                { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
                { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
                { model: 'heading5', view: 'h5', title: 'Heading 5', class: 'ck-heading_heading5' },
                { model: 'heading6', view: 'h6', title: 'Heading 6', class: 'ck-heading_heading6' }
            ]
        },
        highlight: {
            options: [
                {
                    model: 'paramMarker',
                    class: 'ck-markerGray',
                    type: 'marker'
                } ]

        },
        image: {
            resizeUnit: 'px',
            toolbar: [
                'imageTextAlternative',
                'imageStyle:alignLeft',
                'imageStyle:alignCenter',
                'imageStyle:alignRight',
                '|',
                'toggleImageCaption'
            ],
            styles: [
                'alignLeft',
                'alignCenter',
                'alignRight'
            ]
        },
        table: {
            contentToolbar: [
                'tableColumn',
                'tableRow',
                'mergeTableCells',
                'tableCellProperties',
                'tableProperties',
                'toggleTableCaption'
            ],
            tableProperties: {
                borderColors: customHexColorsConfig,
                backgroundColors: customHexColorsConfig
            },
            tableCellProperties: {
                borderColors: customHexColorsConfig,
                backgroundColors: customHexColorsConfig
            }
        },
        fontSize: {
            options: [ 'default', 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72 ],
            supportAllValues: true
        },
        fontColor: {
            colors: customHexColorsConfig
        },
        fontBackgroundColor: {
            colors: customHexColorsConfig
        },
        fontFamily: {
			options: [
				'맑은 고딕, Malgun Gothic, Gulim, Arial, Helvetica, sans-serif', 
				'굴림, Gulim, sans-serif', 
				'굴림체, GulimChe, sans-serif', 
				'바탕, Batang, Times New Roman, Times, serif', 
				'바탕체, BatangChe, Times New Roman, Times, serif', 
				'Arial, Helvetica, sans-serif',
				'Comic Sans MS, cursive',
				'Courier New, Courier, monospace',
				'Georgia, serif',
				'Lucida Sans Unicode, Lucida Grande, sans-serif',
				'Tahoma, Geneva, sans-serif',
				'Times New Roman, Times, serif',
				'Trebuchet MS, Helvetica, sans-serif',
				'Verdana, Geneva, sans-serif'
			],
            supportAllValues: true
        },
        language: localeName,
        math: {
            engine: 'mathjax', // or katex or function. E.g. (equation, element, display) => { ... }
            outputType: 'span', // or script
            forceOutputType: false, // forces output to use outputType
            enablePreview: true // Enable preview view
        },
        mention: {
            feeds: [ {
                marker: ' ',
                feed: getAutoCompleteItems
            } ]
        },
        users: {
            colorsCount: 10    // customize number of colors to show in the users presense list
        }
    };
}

function _getAdvanceCKEditor5ConfigWatermark() {
    var localeName = _getLocaleName();
    return {
        toolbar: [
            'fontFamily',
            'fontColor'
        ],
        fontColor: {
            colors: customHexColorsConfig
        },
        fontFamily: {
			options: [
				'맑은 고딕, Malgun Gothic, Gulim, Arial, Helvetica, sans-serif', 
				'굴림, Gulim, sans-serif', 
				'굴림체, GulimChe, sans-serif', 
				'바탕, Batang, Times New Roman, Times, serif', 
				'바탕체, BatangChe, Times New Roman, Times, serif', 
				'Arial, Helvetica, sans-serif',
				'Comic Sans MS, cursive',
				'Courier New, Courier, monospace',
				'Georgia, serif',
				'Lucida Sans Unicode, Lucida Grande, sans-serif',
				'Tahoma, Geneva, sans-serif',
				'Times New Roman, Times, serif',
				'Trebuchet MS, Helvetica, sans-serif',
				'Verdana, Geneva, sans-serif'
			],
            supportAllValues: true
        },
        language: localeName

    };
}
const customHexColorsConfig = [ {
    color: '#000000',
    label: 'Black'
},
{
    color: '#4d4d4d',
    label: 'Dim grey'
},
{
    color: '#999999',
    label: 'Grey'
},
{
    color: '#e6e6e6',
    label: 'Light grey'
},
{
    color: '#ffffff',
    label: 'White',
    hasBorder: true
},
{
    color: '#e64c4c',
    label: 'Red'
},
{
    color: '#e6994c',
    label: 'Orange'
},
{
    color: '#e6e64c',
    label: 'Yellow'
},
{
    color: '#99e64c',
    label: 'Light green'
},
{
    color: '#4ce64c',
    label: 'Green'
},
{
    color: '#4ce699',
    label: 'Aquamarine'
},
{
    color: '#4ce6e6',
    label: 'Turquoise'
},
{
    color: '#4c99e6',
    label: 'Light blue'
},
{
    color: '#4c4ce6',
    label: 'Blue'
},
{
    color: '#994ce6',
    label: 'Purple'
}
];
