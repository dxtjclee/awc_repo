

import { extractDelimiters, hasDelimiters } from 'js/rmCkeInsertEquation/utils';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
import MathView from 'js/rmCkeInsertEquation/mathview';
import localeService from 'js/localeService';

var resource = 'RichTextEditorCommandPanelsMessages';
var localTextBundle;

export default class MainFormView extends ckeditor5ServiceInstance.View {
    constructor( locale, engine, previewEnabled, previewUid ) {
        super( locale );

        const t = locale.t;
        localTextBundle = localeService.getLoadedText( resource );

        // Create key event & focus trackers
        this._createKeyAndFocusTrackers();

        // Equation input
        this.mathInputView = this._createMathInput();

        // Display button
        this.displayButtonView = this._createDisplayButton();

        // Submit button
        this.saveButtonView = this._createButton( t( 'Save' ), ckeditor5ServiceInstance.checkIcon, 'ck-button-save', null );
        this.saveButtonView.type = 'submit';

        // Cancel button
        this.cancelButtonView = this._createButton( t( 'Cancel' ), ckeditor5ServiceInstance.cancelIcon, 'ck-button-cancel', 'cancel' );

        this.previewEnabled = previewEnabled;

        let children = [];
        if ( this.previewEnabled ) {
            // Preview label
            this.previewLabel = new ckeditor5ServiceInstance.LabelView( locale );
            this.previewLabel.text = localTextBundle.equationPreviewLabel ? localTextBundle.equationPreviewLabel : 'Equation preview';

            // Math element
            this.mathView = new MathView( engine, locale, previewUid );
            this.mathView.bind( 'display' ).to( this.displayButtonView, 'isOn' );

            children = [
                this.mathInputView,
                this.displayButtonView,
                this.previewLabel,
                this.mathView
            ];
        } else {
            children = [
                this.mathInputView,
                this.displayButtonView
            ];
        }

        // Add UI elements to template
        this.setTemplate( {
            tag: 'form',
            attributes: {
                class: [
                    'ck',
                    'ck-math-form'
                ],
                tabindex: '-1',
                spellcheck: 'false'
            },
            children: [
                {
                    tag: 'div',
                    attributes: {
                        class: [
                            'ck-math-view'
                        ]
                    },
                    children
                },
                this.saveButtonView,
                this.cancelButtonView
            ]
        } );
    }

    render() {
        super.render();

        // Prevent default form submit event & trigger custom 'submit'
        ckeditor5ServiceInstance.submitHandler( {
            view: this
        } );

        // Register form elements to focusable elements
        const childViews = [
            this.mathInputView,
            this.displayButtonView,
            this.saveButtonView,
            this.cancelButtonView
        ];

        childViews.forEach( v => {
            this._focusables.add( v );
            this.focusTracker.add( v.element );
        } );

        // Listen to keypresses inside form element
        this.keystrokes.listenTo( this.element );
    }

    focus() {
        this._focusCycler.focusFirst();
    }

    get equation() {
        return this.mathInputView.inputView.element.value;
    }

    set equation( equation ) {
        this.mathInputView.inputView.element.value = equation;
        if ( this.previewEnabled ) {
            this.mathView.value = equation;
        }
    }

    _createKeyAndFocusTrackers() {
        this.focusTracker = new ckeditor5ServiceInstance.FocusTracker();
        this.keystrokes = new ckeditor5ServiceInstance.KeystrokeHandler();
        this._focusables = new ckeditor5ServiceInstance.ViewCollection();

        this._focusCycler = new ckeditor5ServiceInstance.FocusCycler( {
            focusables: this._focusables,
            focusTracker: this.focusTracker,
            keystrokeHandler: this.keystrokes,
            actions: {
                focusPrevious: 'shift + tab',
                focusNext: 'tab'
            }
        } );
    }

    _createMathInput() {
        // Create equation input
        const mathInput = new ckeditor5ServiceInstance.LabeledInputView( this.locale, ckeditor5ServiceInstance.InputTextView );
        const inputView = mathInput.inputView;
        mathInput.infoText = localTextBundle.insertEquationInTeXFormatLabel ? localTextBundle.insertEquationInTeXFormatLabel : 'Insert equation in TeX format.';
        inputView.on( 'input', () => {
            if ( this.previewEnabled ) {
                const equationInput = inputView.element.value.trim();

                // If input has delimiters
                if ( hasDelimiters( equationInput ) ) {
                    // Get equation without delimiters
                    const params = extractDelimiters( equationInput );

                    // Remove delimiters from input field
                    inputView.element.value = params.equation;

                    // update display button and preview
                    this.displayButtonView.isOn = params.display;
                    if ( this.previewEnabled ) {
                        // Update preview view
                        this.mathView.value = params.equation;
                    }
                } else {
                    this.mathView.value = equationInput;
                }
            }
        } );

        return mathInput;
    }

    _createButton( label, icon, className, eventName ) {
        const button = new ckeditor5ServiceInstance.ButtonView( this.locale );

        button.set( {
            label,
            icon,
            tooltip: true
        } );

        button.extendTemplate( {
            attributes: {
                class: className
            }
        } );

        if ( eventName ) {
            button.delegate( 'execute' ).to( this, eventName );
        }

        return button;
    }

    _createDisplayButton() {
        const switchButton = new ckeditor5ServiceInstance.ButtonView( this.locale );

        switchButton.set( {
            label: localTextBundle.equationDisplayMode ? localTextBundle.equationDisplayMode : 'Display mode',
            withText: true
        } );

        switchButton.extendTemplate( {
            attributes: {
                class: 'ck-button-display-toggle'
            }
        } );

        switchButton.on( 'execute', () => {
            // Toggle state
            switchButton.isOn = !switchButton.isOn;

            if ( this.previewEnabled ) {
                // Update preview view
                this.mathView.display = switchButton.isOn;
            }
        } );

        return switchButton;
    }
}
