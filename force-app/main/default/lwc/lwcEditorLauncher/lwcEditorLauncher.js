import { LightningElement } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class lwcEditorLauncher extends NavigationMixin(LightningElement) {

    openLwcEditor() {
        const url = '/c/LwcEditorApp.app';
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: url
            }
        },
        false // Open in a new tab
        );
    }
}