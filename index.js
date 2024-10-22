// Wrapping the whole extension in a JS function 
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
  
  // Refer to Anthropic's guide on system prompts here: https://docs.anthropic.com/claude/docs/system-prompts
  const systemPrompt = "You are a helpful assistant."
  
  // register(id: unique button id, name: name of button visible in Coach, function: function to call when button is clicked) 
  codioIDE.coachBot.register("translateContentPageButton", "Translate all pages in this assignment to JS", onButtonPress)

  // function called when I have a question button is pressed
  async function onButtonPress() {

    // Let's add a chapter first for the translated content
    let chapter_res
    try {
        chapter_res = await window.codioIDE.guides.structure.add({
            title: 'Javascript', 
            type: window.codioIDE.guides.structure.ITEM_TYPES.CHAPTER
        })
        console.log('add item result', chapter_res) // returns added item: {id: '...', title: '...', type: '...', children: [...]}
    } catch (e) {
        console.error(e)
    }
    
    // fetch filetree
    let filetree = await codioIDE.files.getStructure()
    // console.log("filetree", filetree)
    
    // recursively search filetree for files with specific extension
    async function getFilesWithExtension(obj, extension) {
        const files = {};

        async function traverse(path, obj) {
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                  // appending next object to traverse to path
                  await traverse(path + "/" + key, obj[key]);
                } else if (obj[key] === 1 && key.toLowerCase().endsWith(extension)) {
                    
                    let filepath = path + "/" + key
                    // removed the first / from filepath
                    filepath = filepath.substring(1)
                    const fileContent = await codioIDE.files.getContent(filepath)
                    files[key] = fileContent
                }
                }
        }
        await traverse("", obj);
        return files;
    }

    // retrieve all markdown files and file content
    const guidePages = await getFilesWithExtension(filetree, '.md')
    // console.log("guidePages from filetree", guidePages)

    // get guides structure for page names and order
    let structure
    try {
        structure = await window.codioIDE.guides.structure.getStructure()
    } catch (e) {
        console.error(e)
    }

    const guideStructureArray = structure.children
    // console.log("guides from structure", guideStructureArray)

    // Define all variables and prompt for API calls
    const ORIGINAL_LANGUAGE = "Java"
    const NEW_LANGUAGE = "Javascript"

    const userPrompt = `
    You are an AI assistant with expertise in translating instructional materials from one programming language to another. Your task is to translate the given content while maintaining the same concepts and structure, only changing the programming language-specific elements.

Here is the original content to be translated:
<original_content>
{ORIGINAL_CONTENT}
</original_content>

The original programming language is ${ORIGINAL_LANGUAGE}, and you need to translate it to ${NEW_LANGUAGE}.

Follow these guidelines for the translation:
1. Keep all the content and concepts covered in the original material the same.
2. Only modify programming language-specific elements to ensure correctness in the new language.
3. Maintain the overall structure and flow of the instructional material.
4. Adapt code examples, syntax, and language-specific terminology to the new programming language.
5. Ensure that explanations and comments are updated to reflect the new language's conventions and best practices.
6. Do not add any explanations, additional comments, or extra functionality that wasn't present in the original content.
7. If there are any portions of the code that cannot be directly translated due to language limitations, provide the closest equivalent functionality and include a comment explaining the adaptation.
8. If there is a {Try It} button command on the page, make sure the filepath in the command starts with code/ - for eg. {Try it}(node code/<filename>.js)


When handling specific elements:
- Keep all image links exactly the same.
- For code file links, keep the filename the same but update the file extension to match the new programming language.

Please provide the translated content, ensuring that it accurately reflects the original material while being correctly adapted to ${NEW_LANGUAGE}. 
Present your translation in the following format:

<translated_content>
[Your translated content goes here]
</translated_content>

Remember to maintain the educational value and clarity of the original content throughout your translation. 
It should also follow markdown formatting.
    `

    for (const filename in guidePages) {
        console.log("filename", filename)
        var guidePageContent = guidePages[filename]
        var updated_prompt = userPrompt.replace('{ORIGINAL_CONTENT}', guidePageContent)

        let pageIndex
        let pageName
        for (let index = 0; index < guideStructureArray.length; index++) {

            var pageElement = guideStructureArray[index]
            var updatedElementName = pageElement.title.replaceAll(" ", "-")
            
            if (filename.includes(updatedElementName)) {
                pageIndex = index
                console.log("Page Index", pageIndex)
                pageName = pageElement.title
                console.log("Page Name", pageName)
                index = guideStructureArray.length + 1
            }
         } 

        codioIDE.coachBot.write(`Translating page on ${pageName} at index ${pageIndex}`)
        // Send the API request to the LLM with all prompts and context 
        const result = await codioIDE.coachBot.ask(
            {
                systemPrompt: systemPrompt,
                messages: [{
                    "role": "user", 
                    "content": updated_prompt
                }]
            }, {stream:false, preventMenu: true}
        )

        console.log("translation result", result)
        const startIndex = result.result.indexOf("<translated_content>") + "<translated_content>".length;
        const endIndex = result.result.indexOf("</translated_content>", startIndex);

        const translated_content = result.result.substring(startIndex, endIndex);

        try {
            const page_res = await window.codioIDE.guides.structure.add({
                title: `${pageName}`, 
                type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
                layout: window.codioIDE.guides.structure.LAYOUT.L_2_PANELS,
                content: `${translated_content}`,
            }, `${chapter_res.id}`, pageIndex+1)
            codioIDE.coachBot.write(`${pageName} Translation complete!! `)
            
            console.log('add item result', page_res) // returns added item: {id: '...', title: '...', type: '...', children: [...]}
        } catch (e) {
            console.error(e)
        }
    }   
    codioIDE.coachBot.showMenu()
  }
// calling the function immediately by passing the required variables
})(window.codioIDE, window)


// try {
//         const res = await window.codioIDE.guides.structure.add({
//           title: 'item 1',
//           layout: window.codioIDE.guides.structure.LAYOUT.L_2_PANELS,
//           type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
//           guidesOnLeft: true,
//           showFileTree: true,
//           showFolders: ['.guides', 'rename'],
//           content: 'some page content',
//           teacherOnly: true,
//           closeAllTabs: true,
//           closeTerminalSession: true,
//           learningObjectives: 'learningObjectives',
//           actions: [{
//             type: window.codioIDE.guides.structure.ACTION_TYPE.FILE,
//             fileName: 'index.json',
//             panel: 0
//           }],
//           media: {
//             name: 'media name',
//             source: 'somefile.mp3',
//             disabled: true,
//             actions: [{
//               type: window.codioIDE.guides.structure.MEDIA_ACTION_TYPE.FILE_OPEN,
//               time: 10,
//               fileNameOrCommand: 'index.json',
//               panel: 0
//             }]
//           }
//         }, null, 1)
 

  
  
