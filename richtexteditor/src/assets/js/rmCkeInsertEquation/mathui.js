import MathEditing from 'js/rmCkeInsertEquation/mathediting';
import MainFormView from 'js/rmCkeInsertEquation/mainformview';
import localeService from 'js/localeService';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
const cmdInsertEquation24 = '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M22,12.8206V0H0V14H12.0316A6.4991,6.4991,0,1,0,22,12.8206Z" class="aw-theme-iconOutline" fill="#464646"/><circle cx="17.5" cy="17.5" r="5.5" fill="#fff"/><path d="M17.5,11A6.4547,6.4547,0,0,1,21,12.0316V1H1V13H12.8206A6.4766,6.4766,0,0,1,17.5,11Z" fill="#fff"/><path d="M5.6143,7,7.9067,3.7905a.5.5,0,1,0-.8134-.581L5,6.14,2.9067,3.21a.5.5,0,1,0-.8134.581L4.3857,7,2.0933,10.21a.5.5,0,1,0,.8134.581L5,7.86l2.0933,2.93a.5.5,0,1,0,.8134-.581Z" class="aw-theme-iconOutline" fill="#464646"/><path d="M19.2905,3.0933a.5.5,0,0,0-.6973.1162L16.5,6.14,14.4067,3.21a.5.5,0,0,0-.8135.581L16,7.16V10.5a.5.5,0,0,0,1,0V7.16l2.4067-3.37A.5.5,0,0,0,19.2905,3.0933Z" class="aw-theme-iconOutline" fill="#464646"/><rect x="9" y="5" width="4" height="1" style="width:4;height:1" class="aw-theme-iconOutline" fill="#464646"/><rect x="9" y="8" width="4" height="1" style="width:4;height:1" class="aw-theme-iconOutline" fill="#464646"/><polygon points="21 17 18 17 18 14 17 14 17 17 14 17 14 18 17 18 17 21 18 21 18 18 21 18 21 17" class="aw-theme-iconOutline" fill="#464646"/></svg>';
const mathKeystroke = 'Ctrl+M';

export default class MathUI extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.ContextualBalloon, MathEditing ];
    }

    static get pluginName() {
        return 'MathUI';
    }

    init() {
        const editor = this.editor;
        editor.editing.view.addObserver( ckeditor5ServiceInstance.ClickObserver );
        var randomId = Math.random().toString( 36 ).substr( 2, 10 );
        // this._previewUid = `math-preview-${CKEDITOR5.uid}`;
        this._previewUid = `math-preview-${ randomId }`;


        this.formView = this._createFormView();

        this._balloon = editor.plugins.get( ckeditor5ServiceInstance.ContextualBalloon );
        this._createToolbarMathButton();

        this._enableUserBalloonInteractions();
    }

    destroy() {
        super.destroy();

        this.formView.destroy();

        // Destroy preview element
        const prewviewEl = document.getElementById( this._previewUid );
        if ( prewviewEl ) {
            prewviewEl.parentNode.removeChild( prewviewEl );
        }
    }

    _showUI() {
        const editor = this.editor;
        const mathCommand = editor.commands.get( 'math' );

        if ( !mathCommand.isEnabled ) {
            return;
        }

        this._addFormView();

        this._balloon.showStack( 'main' );
    }

    _createFormView() {
        const editor = this.editor;
        const mathCommand = editor.commands.get( 'math' );

        const mathConfig = this.editor.config.get( 'math' );

        const formView = new MainFormView( editor.locale, mathConfig.engine, mathConfig.enablePreview, this._previewUid );

        formView.mathInputView.bind( 'value' ).to( mathCommand, 'value' );
        formView.displayButtonView.bind( 'isOn' ).to( mathCommand, 'display' );

        // Form elements should be read-only when corresponding commands are disabled.
        formView.mathInputView.bind( 'isReadOnly' ).to( mathCommand, 'isEnabled', value => !value );
        formView.saveButtonView.bind( 'isEnabled' ).to( mathCommand );
        formView.displayButtonView.bind( 'isEnabled' ).to( mathCommand );

        // Listen to submit button click
        this.listenTo( formView, 'submit', () => {
            editor.execute( 'math', formView.equation, formView.displayButtonView.isOn, mathConfig.outputType, mathConfig.forceOutputType );
            this._closeFormView();
        } );

        // Listen to cancel button click
        this.listenTo( formView, 'cancel', () => {
            this._closeFormView();
        } );

        // Close plugin ui, if esc is pressed (while ui is focused)
        formView.keystrokes.set( 'esc', ( data, cancel ) => {
            this._closeFormView();
            cancel();
        } );

        return formView;
    }

    _addFormView() {
        if ( this._isFormInPanel ) {
            return;
        }

        const editor = this.editor;
        const mathCommand = editor.commands.get( 'math' );

        this._balloon.add( {
            view: this.formView,
            position: this._getBalloonPositionData()
        } );

        if ( this._balloon.visibleView === this.formView ) {
            this.formView.mathInputView.select();
        }

        // Show preview element
        const prewviewEl = document.getElementById( this._previewUid );
        if ( prewviewEl && this.formView.previewEnabled ) {
            // Force refresh preview
            this.formView.mathView.updateMath();
        }

        this.formView.equation = mathCommand.value || '';
        this.formView.displayButtonView.isOn = mathCommand.display || false;
    }

    _hideUI() {
        if ( !this._isFormInPanel ) {
            return;
        }

        const editor = this.editor;

        this.stopListening( editor.ui, 'update' );
        this.stopListening( this._balloon, 'change:visibleView' );

        editor.editing.view.focus();

        // Remove form first because it's on top of the stack.
        this._removeFormView();
    }

    _closeFormView() {
        const mathCommand = this.editor.commands.get( 'math' );
        if ( mathCommand.value !== undefined ) {
            this._removeFormView();
        } else {
            this._hideUI();
        }
    }

    _removeFormView() {
        if ( this._isFormInPanel ) {
            this.formView.saveButtonView.focus();

            this._balloon.remove( this.formView );

            // Hide preview element
            const prewviewEl = document.getElementById( this._previewUid );
            if ( prewviewEl ) {
                prewviewEl.style.visibility = 'hidden';
            }

            this.editor.editing.view.focus();
        }
    }

    _getBalloonPositionData() {
        const view = this.editor.editing.view;
        const viewDocument = view.document;
        const target = view.domConverter.viewRangeToDom( viewDocument.selection.getFirstRange() );
        return { target };
    }

    _createToolbarMathButton() {
        const editor = this.editor;
        const mathCommand = editor.commands.get( 'math' );
        var resource = 'RichTextEditorCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );
        // Handle the `Ctrl+M` keystroke and show the panel.
        editor.keystrokes.set( mathKeystroke, ( keyEvtData, cancel ) => {
            // Prevent focusing the search bar in FF and opening new tab in Edge. #153, #154.
            cancel();

            if ( mathCommand.isEnabled ) {
                this._showUI();
            }
        } );

        this.editor.ui.componentFactory.add( 'math', locale => {
            const button = new ckeditor5ServiceInstance.ButtonView( locale );
            button.isEnabled = true;
            button.label = localTextBundle.insertMath;//added for localized tool-tip in command
            button.icon = cmdInsertEquation24; //added for command icon inside toolbar
            button.keystroke = mathKeystroke;
            button.tooltip = true;
            button.isToggleable = true;

            button.bind( 'isEnabled' ).to( mathCommand, 'isEnabled' );

            this.listenTo( button, 'execute', () => this._showUI() );

            return button;
        } );
    }

    _enableUserBalloonInteractions() {
        // Close the panel on the Esc key press when the editable has focus and the balloon is visible.
        this.editor.keystrokes.set( 'Esc', ( data, cancel ) => {
            if ( this._isUIVisible ) {
                this._hideUI();
                cancel();
            }
        } );

        // Close on click outside of balloon panel element.
        ckeditor5ServiceInstance.clickOutsideHandler( {
            emitter: this.formView,
            activator: () => this._isFormInPanel,
            contextElements: [ this._balloon.view.element ],
            callback: () => this._hideUI()
        } );
    }

    get _isUIVisible() {
        const visibleView = this._balloon.visibleView;

        return visibleView === this.formView;
    }

    get _isFormInPanel() {
        return this._balloon.hasView( this.formView );
    }
}
