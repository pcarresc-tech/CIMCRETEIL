/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';

// App setup
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.container') as HTMLDivElement;
    const resultText = document.getElementById('result-text') as HTMLPreElement;
    const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;

    // --- View-Only Mode Logic ---
    // Check for a document hash in the URL to activate view-only mode
    if (window.location.hash && window.location.hash.length > 1) {
        try {
            const encodedData = window.location.hash.substring(1);
            const decodedText = atob(decodeURIComponent(encodedData));

            if (container && resultText && copyBtn) {
                // Activate view mode by applying a class to the main container
                container.classList.add('view-mode');
                
                // Display the decoded document
                resultText.textContent = decodedText;

                // Show the copy button
                copyBtn.classList.remove('hidden');
                
                // Adjust titles for clarity in view mode
                const mainTitle = document.querySelector('header h1') as HTMLHeadingElement;
                if(mainTitle) mainTitle.textContent = "Autorisation de Transport";
                const outputTitle = document.querySelector('.output-container h2') as HTMLHeadingElement;
                if(outputTitle) outputTitle.textContent = "Document Officiel";
                
                // Add a simple event listener for the copy button in view mode
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(resultText.innerText).then(() => {
                        const originalText = copyBtn.innerHTML;
                        copyBtn.innerHTML = 'Copié !';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.innerHTML = originalText;
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                });
            }
            return; // Stop execution to prevent setting up the interactive form
        } catch (e) {
            console.error("Failed to decode document data from URL hash:", e);
            // Fallback to normal app mode if hash is invalid
        }
    }

    // --- Interactive Form Mode Logic ---
    const form = document.getElementById('doc-form') as HTMLFormElement;
    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    const loader = document.getElementById('loader') as HTMLDivElement;
    const errorMessage = document.getElementById('error-message') as HTMLDivElement;
    const publishBtn = document.getElementById('publish-btn') as HTMLButtonElement;
    const shareLinkContainer = document.getElementById('share-link-container') as HTMLDivElement;
    const shareLinkInput = document.getElementById('share-link') as HTMLInputElement;
    const copyLinkBtn = document.getElementById('copy-link-btn') as HTMLButtonElement;

    if (!form || !generateBtn || !loader || !errorMessage || !publishBtn || !shareLinkContainer || !shareLinkInput || !copyLinkBtn) {
        console.error('A required element is missing from the DOM for the interactive application.');
        return;
    }

    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateDocument();
    });
    
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(resultText.innerText).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = 'Copié !';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    });

    publishBtn.addEventListener('click', () => {
        const content = resultText.innerText;
        if (!content) return;

        try {
            const encodedContent = encodeURIComponent(btoa(content));
            const url = `${window.location.origin}${window.location.pathname}#${encodedContent}`;
            
            shareLinkInput.value = url;
            shareLinkContainer.classList.remove('hidden');
        } catch (e) {
            console.error('Error encoding content for sharing:', e);
            errorMessage.textContent = 'Erreur lors de la création du lien de partage.';
            errorMessage.classList.remove('hidden');
        }
    });

     copyLinkBtn.addEventListener('click', () => {
        shareLinkInput.select();
        navigator.clipboard.writeText(shareLinkInput.value).then(() => {
            const originalHTML = copyLinkBtn.innerHTML;
            copyLinkBtn.textContent = 'Lien copié';
            copyLinkBtn.classList.add('copied');
            setTimeout(() => {
                copyLinkBtn.innerHTML = originalHTML;
                copyLinkBtn.classList.remove('copied');
            }, 2000);
        });
    });

    /**
     * Parses a date string in DD/MM/YYYY or DD MM YYYY format into a Date object.
     * @param dateStr The date string to parse.
     * @returns A Date object or null if the format is invalid.
     */
    function parseDate(dateStr: string): Date | null {
        const parts = dateStr.replace(/\//g, ' ').split(' ').filter(p => p);
        if (parts.length !== 3) return null;
        
        const [day, month, year] = parts.map(Number);
        
        if (isNaN(day) || isNaN(month) || isNaN(year) || 
            day < 1 || day > 31 || 
            month < 1 || month > 12 || 
            year < 1900 || year > 3000) {
            return null;
        }
        
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return date;
        }
        
        return null;
    }

    function validateDates(authDateStr: string, issueDateStr: string): string | null {
        const authDateInput = document.getElementById('authDate') as HTMLInputElement;
        const issueDateInput = document.getElementById('issueDate') as HTMLInputElement;

        authDateInput.classList.remove('invalid');
        issueDateInput.classList.remove('invalid');

        const authDate = parseDate(authDateStr);
        if (!authDate) {
            authDateInput.classList.add('invalid');
            return "Le format de la 'Date autorisation transport' est invalide. Utilisez JJ/MM/AAAA.";
        }
        
        const issueDate = parseDate(issueDateStr);
        if (!issueDate) {
            issueDateInput.classList.add('invalid');
            return "Le format de la 'Date d'établissement' est invalide. Utilisez JJ/MM/AAAA.";
        }

        if (issueDate < authDate) {
            authDateInput.classList.add('invalid');
            issueDateInput.classList.add('invalid');
            return "La 'Date d'établissement' ne peut pas être antérieure à la 'Date autorisation transport'.";
        }
        
        return null; // No errors
    }

    async function generateDocument() {
        setLoading(true);
        resultText.textContent = '';
        copyBtn.classList.add('hidden');
        publishBtn.classList.add('hidden');
        shareLinkContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');

        const data = {
            mayorName: (document.getElementById('mayorName') as HTMLInputElement).value,
            communeName: (document.getElementById('communeName') as HTMLInputElement).value,
            postalCode: (document.getElementById('postalCode') as HTMLInputElement).value,
            authDate: (document.getElementById('authDate') as HTMLInputElement).value,
            companyName: (document.getElementById('companyName') as HTMLInputElement).value,
            companyAddress: (document.getElementById('companyAddress') as HTMLInputElement).value,
            crematoriumInfo: (document.getElementById('crematoriumInfo') as HTMLInputElement).value,
            habilitationNumber: (document.getElementById('habilitationNumber') as HTMLInputElement).value,
            placeOfIssue: (document.getElementById('placeOfIssue') as HTMLInputElement).value,
            issueDate: (document.getElementById('issueDate') as HTMLInputElement).value,
            delegateName: (document.getElementById('delegateName') as HTMLInputElement).value,
            delegateTitle: (document.getElementById('delegateTitle') as HTMLInputElement).value,
            signature: (document.getElementById('signature') as HTMLInputElement).value,
        };
        
        const validationError = validateDates(data.authDate, data.issueDate);
        if (validationError) {
            errorMessage.textContent = validationError;
            errorMessage.classList.remove('hidden');
            setLoading(false);
            return;
        }

        try {
            const prompt = `
Agis en tant qu'officier d'état civil français. Rédige une "AUTORISATION DE TRANSPORT" formelle et officielle en utilisant exclusivement les informations suivantes. Le document doit suivre scrupuleusement la structure et le ton légal et administratif français. Ne génère que le texte du document, sans aucun commentaire, en-tête ou explication supplémentaire.

**Informations à intégrer :**
- **Maire :** M. ${data.mayorName}
- **Commune :** ${data.communeName} (${data.postalCode})
- **Date de délivrance de l'autorisation de transport initiale :** ${data.authDate}
- **Entreprise funéraire :** ${data.companyName}, située au ${data.companyAddress}
- **Destination :** Crématorium ${data.crematoriumInfo}
- **Numéro d'habilitation :** ${data.habilitationNumber} (délivré par la préfecture de ${data.placeOfIssue})
- **Date d'établissement :** ${data.issueDate}
- **Lieu d'établissement :** ${data.placeOfIssue}
- **Signataire par délégation :** M. ${data.delegateName}, ${data.delegateTitle}
- **Signature numérique :** ${data.signature}

**Structure impérative :**
1. Titre : AUTORISATION DE TRANSPORT
2. Introduction du maire.
3. Visas des articles de loi (R. 2213-34 à R. 2213-39 et R. 2213-44 à R. 2213-52 du code Général des Collectivités Territoriales).
4. Visa de l'autorisation de transport et de la demande de la mairie.
5. Déclaration sur l'absence de refus de crémation.
6. Identification complète de l'entreprise funéraire.
7. Objet de l'autorisation : transport pour crémation avec mention de l'inventaire en annexe.
8. Destination (crématorium).
9. Mention de l'habilitation de l'entreprise.
10. Date d'établissement.
11. Lieu et date.
12. Bloc de signature pour le délégataire. Ce bloc doit inclure "Pour le Maire et par délégation,", la signature numérique, le nom complet, et le titre du délégataire. La signature doit être visuellement distincte.
`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const generatedText = response.text;
            resultText.textContent = generatedText;
            copyBtn.classList.remove('hidden');
            publishBtn.classList.remove('hidden');

        } catch (error) {
            console.error('Error generating document:', error);
            resultText.textContent = 'Une erreur est survenue lors de la génération du document. Veuillez vérifier la console pour plus de détails.';
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading: boolean) {
        if (isLoading) {
            loader.classList.remove('hidden');
            generateBtn.disabled = true;
        } else {
            loader.classList.add('hidden');
            generateBtn.disabled = false;
        }
    }
});