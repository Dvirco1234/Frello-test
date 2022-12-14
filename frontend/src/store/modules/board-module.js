import { boardService } from '../../services/board-service'
import { utilService } from '../../services/util-service.js'
import { applyDrag } from '../../services/dnd-util.service'
import { FastAverageColor } from 'fast-average-color'

export default {
    state: {
        boards: [],
        currBoard: null,
        searchBoardRes: null,
        previousBoardState: null,
        currTaskData: {},
        isMemberDrag: false,
    },
    getters: {
        board({ currBoard }) {
            return currBoard
        },
        templateBoards({ boards }) {
            return boards.filter(board => board.isTemplate)
        },
        boards({ boards }) {
            return boards.filter(board => !board.isTemplate)
        },
        // recentBoards({ boards }) {
        //     boards.filter(b => b.visitedAt)
        //     // console.log(boards);
        //     return boards//.sort((a, b) => b - a)
        // },
        boardCreatedBy({ currBoard }) {
            return currBoard.createdBy
        },
        boardMembers({ currBoard }) {
            return currBoard.members
        },
        boardLabels({ currBoard }) {
            return currBoard.labels
        },
        groups({ currBoard }) {
            return currBoard.groups
        },
        currTaskData({ currTaskData }) {
            return currTaskData
        },
        activities({ currBoard }) {
            return currBoard.activities
        },
        searchBoardRes({ searchBoardRes }) {
            return searchBoardRes
        },
        isMemberDrag(state) {
            return state.isMemberDrag
        },
    },
    mutations: {
        undo(state) {
            state.currBoard = state.previousBoardState
        },
        savePrevState(state) {
            state.previousBoardState = state.currBoard
        },
        searchInBoard(state, { queryStr }) {
            const regex = new RegExp(queryStr, 'i')
            const resTasks = []
            state.currBoard.groups.forEach(g => {
                resTasks.push(...g.tasks.filter(t => regex.test(t.title)))
            })
            state.searchBoardRes = resTasks
        },
        memberDrag(state, { isDrag }) {
            state.isMemberDrag = isDrag
        },
        newActivity(state, { activity }) {
            const activities = state.currBoard.activities
            if (activities.length > 100) activities.pop()
            activity.id = utilService.makeId()
            activities.unshift(activity)
        },
        //board
        setBoards(state, { boards }) {
            state.boards = boards
        },
        updateBoard(state, { updatedBoard }) {
            state.currBoard = updatedBoard
        },
        addMemberToBoard(state, { member }) {
            state.currBoard.members.push(member)
        },
        setCurrTask(state, { groupId, taskId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            state.currTaskData = { group, task }
        },
        board(state, { change, board }) {
            const idx = state.boards.findIndex(b => b._id === board._id)
            switch (change) {
                case 'add':
                    state.boards.push(board)
                    state.currBoard = board
                    break
                case 'update':
                    state.boards.splice(idx, 1, board)
                    break
                case 'remove':
                    state.boards.splice(idx, 1)
                    break
                case 'set':
                    state.currBoard = board
            }
        },
        changeBoardTitle(state, { title }) {
            state.currBoard.title = title
        },
        //group
        saveGroup(state, { group }) {
            const idx = state.currBoard.groups.findIndex(g => g.id === group.id)
            if (group.id) state.currBoard.groups.splice(idx, 1, group)
            else {
                group.id = utilService.makeId()
                state.currBoard.groups.push(group)
            }
        },
        duplicateGroup(state, { group }) {
            group.id = utilService.makeId()
            state.currBoard.groups.push(group)
        },
        toggleWatchGroup(state, { groupId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            if (group.isWatched) group.isWatched = false
            else group.isWatched = true
        },
        sortGroup(state, { groupId, sortBy }) {
            let tasks = state.currBoard.groups.find(g => g.id === groupId).tasks
            if (sortBy === 'alphabet') tasks = tasks.sort((a, b) => a.title.localeCompare(b.title))
            else tasks = tasks.sort((a, b) => (a.createdAt - b.createdAt) * (sortBy === 'oldest' ? 1 : -1))
        },
        archiveGroup(state, { groupId }) {
            const groupIdx = state.currBoard.groups.findIndex(g => g.id === groupId)
            state.currBoard.groups.splice(groupIdx, 1)
        },
        //task
        addTask(state, { groupId, task }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            task.id = utilService.makeId()
            group.tasks.push(task)
        },
        editTaskTitle(state, { taskId, groupId, title }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            task.title = title
            state.currTaskData.task = task
        },
        saveTaskDescription(state, { taskId, groupId, description }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            task.description = description
            state.currTaskData.task = task
        },
        archiveTask(state, { taskId, groupId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const taskIdx = group.tasks.findIndex(t => t.id === taskId)
            group.tasks.splice(taskIdx, 1)
        },
        archiveAllTasks(state, { groupId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            group.tasks = []
        },
        toggleWatchTask(state, { taskId, groupId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            task.isWatched = task.isWatched ? false : true
            state.currTaskData.task = task
        },
        moveTask(state, { from, to }) {
            //moving the task from the previous group
            const originGroup = state.currBoard.groups.find(g => g.id === from.groupId)
            const originTaskIdx = originGroup.tasks.findIndex(t => t.id === from.taskId)
            const taskToMove = originGroup.tasks.splice(originTaskIdx, 1)[0] //extract the moved task
            //to the new group at the specified location
            const destGroup = state.currBoard.groups.find(g => g.id === to.groupId)
            destGroup.tasks.splice(to.idx, 0, taskToMove) //insert at wanted location
            state.currTaskData.task = task
        },
        //attachments
        saveAttachment(state, { taskId, groupId, attachment }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            if (!task.attachments) task.attachments = []
            task.attachments.push(attachment)
            state.currTaskData.task = task
        },
        removeAttachment(state, { taskId, groupId, idx }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            task.attachments.splice(idx, 1)
            state.currTaskData.task = task
        },
        //labels
        toggleLabel(state, { taskId, groupId, labelId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)

            const labelIdx = task.labelIds.findIndex(id => id === labelId)
            if (labelIdx !== -1) task.labelIds.splice(labelIdx, 1)
            else if (task.labelIds.length < 4) task.labelIds.push(labelId)
            state.currTaskData.task = task
        },
        saveLabel(state, { taskId, groupId, label }) {
            // console.log('ss');
            //boardwide
            if (label.id) {
                const idx = state.currBoard.labels.findIndex(l => l.id === label.id)
                state.currBoard.labels.splice(idx, 1, label)
            } else {
                const group = state.currBoard.groups.find(g => g.id === groupId)
                const task = group.tasks.find(t => t.id === taskId)
                if (task.labelIds.length >= 4) return
                label.id = utilService.makeId()
                state.currBoard.labels.push(label)
                task.labelIds.push(label.id)
                state.currTaskData.task = task
            }
        },
        //members
        toggleMember(state, { taskId, groupId, memberId }) {
            // console.log('taskId:', taskId, groupId, memberId)
            const member = state.currBoard.members.find(m => m._id === memberId)
            if (!member) return
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            const memberIdx = task.memberIds.findIndex(mId => mId === memberId)
            if (memberIdx !== -1) task.memberIds.splice(memberIdx, 1)
            else task.memberIds.push(memberId)
            state.currTaskData.task = task
        },
        toggleBoardStarred({ currBoard }, { board }) {
            const toggeledBoard = board ? board : currBoard
            toggeledBoard.isStarred = !toggeledBoard.isStarred
            // currBoard.isStarred = !currBoard.isStarred
        },
        toggleLabelsText({ currBoard }, { board }) {
            // const toggeledBoard = board ? board : currBoard
            // toggeledBoard.isStarred = !toggeledBoard.isStarred
            currBoard.isLabelsTextShow = !currBoard.isLabelsTextShow
        },
        //todos
        newTodoList(state, { taskId, groupId, title }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            const list = {
                title,
                id: utilService.makeId(),
                todos: [],
            }
            if (!task.todoLists) task.todoLists = []
            task.todoLists.push(list)
            state.currTaskData.task = task
        },
        addTodo(state, { taskId, groupId, listId, title }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            const list = task.todoLists.find(l => l.id === listId)
            const todo = {
                title,
                id: utilService.makeId(),
                isDone: false,
            }
            list.todos.push(todo)
            state.currTaskData.task = task
        },
        toggleTodo(state, { taskId, groupId, listId, todoId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            const list = task.todoLists.find(l => l.id === listId)
            const todo = list.todos.find(td => td.id === todoId)
            todo.isDone = !todo.isDone
            const doneTodosNum = list.todos.filter(td => td.isDone).length
            list.prograss = parseInt((doneTodosNum / list.todos.length) * 100) + '%'
            state.currTaskData.task = task
        },
        deleteTodoList(state, { taskId, groupId, listId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            const listIdx = task.todoLists.findIndex(l => l.id === listId)
            task.todoLists.splice(listIdx, 1)
            state.currTaskData.task = task
        },
        toggleHideChecked(state, { taskId, groupId, listId }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            const list = task.todoLists.find(l => l.id === listId)
            list.checkedHidden = list.checkedHidden ? false : true
            state.currTaskData.task = task
        },
        //due-date
        setDueDate(state, { taskId, groupId, dueDate }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            task.dueDate = dueDate
            state.currTaskData.task = task
        },
        //cover
        setCover(state, { taskId, groupId, cover }) {
            const group = state.currBoard.groups.find(g => g.id === groupId)
            const task = group.tasks.find(t => t.id === taskId)
            if (cover === 'reset') task.cover = null
            else task.cover = cover
            state.currTaskData.task = task
        },
        //d&d
        dragTask(state, { groupIndex, group, board }) {
            state.currBoard.groups.splice(groupIndex, 1, group)
            // board.groups.splice(groupIndex, 1, newGroup)
            // state.currBoard = board
        },
        clearCurrBoard(state) {
            state.currBoard = null
        },
        setBg(state, { background, color }) {
            state.currBoard.style.background = background
            var colorHexa;
            if (typeof color === 'object') {
                colorHexa = color.hexa
            } else {
                colorHexa = color
            }
            state.currBoard.style.colorHexa = colorHexa
            state.currBoard.style.avgColor = color
        },

    },
    actions: {
        clearCurrBoard({ commit }) {
            commit({ type: 'clearCurrBoard' })
        },
        async loadBoards({ commit }) {
            try {
                const boards = await boardService.query()
                commit({ type: 'setBoards', boards })
            } catch {
                console.log('couldnt load boards')
            }
        },
        async board({ commit }, { action, board }) {
            try {
                let change
                if (action === 'save') {
                    change = board._id ? 'update' : 'add'
                    board = await boardService.saveBoard(board)
                } else if (action === 'remove') {
                    change = 'remove'
                    await boardService.removeBoard(board._id)
                } else if (action === 'set') {
                    change = 'set'
                    board = await boardService.getById(board)
                    boardService.setCurrBoard(board)
                }
                commit({ type: 'board', change, board })
                return board
            } catch (err) {
                console.error(err)
            }
        },
        async saveBoard({ commit, state }, { payload }) {
            const { action } = payload
            const changedBoard = payload.board ? payload.board : state.currBoard
            try {
                await boardService.saveBoard(changedBoard)
            } catch (err) {
                console.error(`ERROR: counldnt complete ${action}`, err)
                commit({ type: 'undo' })
            }
        },

        setState({ commit, dispatch }, payload) {
            const { action } = payload
            payload.type = action
            commit({ type: 'savePrevState' })
            commit(payload)
            dispatch({ type: 'saveBoard', payload })
        },

        //d&d
        async updateGroups({ commit }, { groups }) {
            const updatedBoard = await boardService.updateGroups(groups)
            commit({ type: 'board', change: 'set', board: updatedBoard })
        },
        async onColumnDrop({ state, commit, dispatch }, { dropResult }) {
            const board = Object.assign({}, state.currBoard)
            board.groups = applyDrag(board.groups, dropResult)
            commit({ type: 'board', change: 'set', board })

            // const updatedBoard = await boardService.updateGroups(board.groups)
            const updatedBoard = await boardService.saveBoard(board)
        },
        async onCardDrop({ state, commit, dispatch, getters }, { groupId, dropResult }) {
            if (dropResult.removedIndex !== null || dropResult.addedIndex !== null) {
                const board = JSON.parse(JSON.stringify(state.currBoard))
                // const board = Object.assign({}, state.currBoard)
                const group = board.groups.filter(g => g.id === groupId)[0]
                const groupIndex = board.groups.indexOf(group)
                // const newGroup = Object.assign({}, group)
                group.tasks = applyDrag(group.tasks, dropResult)
                commit({ type: 'dragTask', groupIndex, group })
                // commit({ type: 'dragTask', groupIndex, board, group })

                // const updatedBoard = await boardService.updateGroups(board.groups)
                const updatedBoard = await boardService.saveBoard(board)
            }
        },
    },
}
