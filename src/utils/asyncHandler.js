const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req,res).
        catch((error) => next(error)))
    }
}

export {asyncHandler}